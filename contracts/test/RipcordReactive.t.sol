// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IReactive} from "reactive-lib-omni/interfaces/IReactive.sol";
import {ISystemContract} from "reactive-lib-omni/interfaces/ISystemContract.sol";
import {AbstractPayer} from "reactive-lib-omni/base/AbstractPayer.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {RipcordReactive} from "../src/RipcordReactive.sol";
import {RipcordVault} from "../src/RipcordVault.sol";
import {SystemStub} from "./utils/SystemStub.sol";
import {OBSERVED_PROXY_OVERHEAD_GAS} from "./utils/ReactiveBudget.sol";

/// @notice RipcordReactive's line book and trigger logic, with the Omni system contract replaced by a test double
/// (D-004). The on-chain loop is what proves Reactive itself.
contract RipcordReactiveTest is Test {
    address internal constant SYSTEM = 0x8888888888888888888888888888888888888888;
    uint256 internal constant REACTIVE_IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad;
    uint256 internal constant POOL_CHAIN = 1301;
    address internal constant POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
    address internal constant VAULT = address(0x7A017);
    bytes32 internal constant POOL = keccak256("pool-a");
    bytes32 internal constant OTHER_POOL = keccak256("pool-b");
    /// @dev Exit gas measured on-chain inside the callback (E-006).
    uint256 internal constant MEASURED_EXIT_GAS = 140_003;

    SystemStub internal sys;
    RipcordReactive internal rc;

    function setUp() public {
        vm.etch(SYSTEM, address(new SystemStub()).code);
        sys = SystemStub(payable(SYSTEM));
        rc = new RipcordReactive(POOL_CHAIN, POOL_MANAGER, VAULT);
    }

    // ---- wiring ----

    function test_SubscribesToVaultLineEventsOnly() public view {
        assertEq(sys.subscriptionCount(), 2);
        (uint256 c0, address e0, uint256 a0,,,) = sys.subscriptions(0);
        (uint256 c1, address e1, uint256 a1,,,) = sys.subscriptions(1);
        assertEq(c0, POOL_CHAIN);
        assertEq(c1, POOL_CHAIN);
        assertEq(e0, VAULT);
        assertEq(e1, VAULT);
        assertEq(a0, uint256(RipcordVault.LineArmed.selector));
        assertEq(a1, uint256(RipcordVault.LineDisarmed.selector));
    }

    function test_SwapTopicIsV4Swap() public view {
        assertEq(rc.SWAP_TOPIC(), uint256(IPoolManager.Swap.selector));
    }

    function test_CallbackBudgetCoversMeasuredExit() public view {
        assertGe(uint256(rc.CALLBACK_GAS()) - OBSERVED_PROXY_OVERHEAD_GAS, 4 * MEASURED_EXIT_GAS);
    }

    function test_MaxLinesMatchesVault() public view {
        assertEq(rc.MAX_LINES_PER_POOL(), 8);
    }

    // ---- line book ----

    function test_FirstLineInPoolSubscribesToThatPoolsSwaps() public {
        _arm(POOL, 1, -60, true);
        assertEq(sys.subscriptionCount(), 3);
        (uint256 c, address e, uint256 t0, uint256 t1, uint256 t2, uint256 t3) = sys.subscriptions(2);
        assertEq(c, POOL_CHAIN);
        assertEq(e, POOL_MANAGER);
        assertEq(t0, rc.SWAP_TOPIC());
        assertEq(t1, uint256(POOL));
        assertEq(t2, REACTIVE_IGNORE);
        assertEq(t3, REACTIVE_IGNORE);
    }

    function test_SecondLineInSamePoolDoesNotResubscribe() public {
        _arm(POOL, 1, -60, true);
        _arm(POOL, 2, 120, false);
        assertEq(sys.subscriptionCount(), 3);
        assertEq(rc.poolLines(POOL).length, 2);
    }

    function test_ReArmUpdatesInPlace() public {
        _arm(POOL, 1, -60, true);
        _arm(POOL, 1, -240, true);
        assertEq(rc.poolLines(POOL).length, 1);
        (, int24 trigger,, bool active) = rc.lines(1);
        assertEq(trigger, -240);
        assertTrue(active);
    }

    function test_DisarmDropsLineAndUnsubscribesEmptyPool() public {
        _arm(POOL, 1, -60, true);
        _disarm(POOL, 1);
        assertEq(rc.poolLines(POOL).length, 0);
        assertEq(sys.unsubscriptionCount(), 1);
        (, address e, uint256 t0, uint256 t1,,) = sys.unsubscriptions(0);
        assertEq(e, POOL_MANAGER);
        assertEq(t0, rc.SWAP_TOPIC());
        assertEq(t1, uint256(POOL));
    }

    function test_NinthLineIsRejected() public {
        for (uint256 i = 1; i <= 8; ++i) {
            _arm(POOL, i, -60, true);
        }
        vm.expectEmit(true, true, false, false, address(rc));
        emit RipcordReactive.LineRejected(POOL, 9);
        _arm(POOL, 9, -60, true);
        assertEq(rc.poolLines(POOL).length, 8);
    }

    // ---- trigger ----

    function test_SwapThatDoesNotCrossRequestsNothing() public {
        _arm(POOL, 1, -60, true);
        _swap(POOL, -59);
        assertEq(sys.requestCount(), 0);
        assertEq(rc.poolLines(POOL).length, 1);
    }

    function test_CrossingBelowRequestsExactlyOneExit() public {
        _arm(POOL, 1, -60, true);
        _swap(POOL, -61);
        assertEq(sys.requestCount(), 1);
        ISystemContract.CallbackConfiguration_V_1_0 memory req = sys.request(0);
        assertEq(req.chainId, POOL_CHAIN);
        assertEq(req.recipient, VAULT);
        assertEq(req.gasLimit, rc.CALLBACK_GAS());
        assertEq(
            req.payload,
            abi.encodeCall(RipcordVault.exit, (address(0), 1, int24(-61), 777, uint256(keccak256("swap-tx"))))
        );
    }

    function test_TouchingTheLineExactlyFires() public {
        _arm(POOL, 1, -60, true);
        _swap(POOL, -60);
        assertEq(sys.requestCount(), 1);
    }

    function test_CrossingAboveRequestsExit() public {
        _arm(POOL, 1, 120, false);
        _swap(POOL, 119);
        assertEq(sys.requestCount(), 0);
        _swap(POOL, 121);
        assertEq(sys.requestCount(), 1);
    }

    function test_LineFiresOnlyOnce() public {
        _arm(POOL, 1, -60, true);
        _swap(POOL, -61);
        _swap(POOL, -200);
        assertEq(sys.requestCount(), 1);
        (,,, bool active) = rc.lines(1);
        assertFalse(active);
    }

    function test_FiringLastLineUnsubscribesPool() public {
        _arm(POOL, 1, -60, true);
        _swap(POOL, -61);
        assertEq(sys.unsubscriptionCount(), 1);
    }

    function test_OneSwapFiresOnlyTheLinesItCrosses() public {
        _arm(POOL, 1, -60, true); // crossed
        _arm(POOL, 2, -300, true); // not crossed
        _arm(POOL, 3, 60, false); // wrong direction
        _arm(POOL, 4, -10, true); // crossed
        _swap(POOL, -100);
        assertEq(sys.requestCount(), 2);
        assertEq(rc.poolLines(POOL).length, 2);
        assertEq(sys.unsubscriptionCount(), 0, "pool still has lines");
    }

    function test_SwapInAnotherPoolIgnoresThisPoolsLines() public {
        _arm(POOL, 1, -60, true);
        _swap(OTHER_POOL, -1000);
        assertEq(sys.requestCount(), 0);
    }

    // ---- authentication ----

    function test_ReactRejectsAnyoneButSystem() public {
        IReactive.LogRecord memory log_ = _swapLog(POOL, -61);
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, address(this), SYSTEM));
        rc.react(log_);
    }

    function test_ReactRejectsLineEventsNotFromVault() public {
        IReactive.LogRecord memory log_ = _armLog(POOL, 1, -60, true);
        log_.contractAddress = address(0xBAD);
        vm.prank(SYSTEM);
        vm.expectRevert(
            abi.encodeWithSelector(RipcordReactive.UnexpectedLog.selector, POOL_CHAIN, address(0xBAD), log_.topic0)
        );
        rc.react(log_);
    }

    function test_ReactRejectsOtherChains() public {
        IReactive.LogRecord memory log_ = _swapLog(POOL, -61);
        log_.chainId = 84532;
        vm.prank(SYSTEM);
        vm.expectRevert(
            abi.encodeWithSelector(RipcordReactive.UnexpectedLog.selector, 84532, POOL_MANAGER, log_.topic0)
        );
        rc.react(log_);
    }

    function test_ConstructorRejectsZeroAddresses() public {
        vm.expectRevert(RipcordReactive.ZeroAddress.selector);
        new RipcordReactive(POOL_CHAIN, address(0), VAULT);
        vm.expectRevert(RipcordReactive.ZeroAddress.selector);
        new RipcordReactive(POOL_CHAIN, POOL_MANAGER, address(0));
    }

    // ---- helpers: logs shaped exactly as the vault and PoolManager emit them ----

    function _arm(bytes32 pool, uint256 tokenId, int24 tick, bool below) internal {
        vm.prank(SYSTEM);
        rc.react(_armLog(pool, tokenId, tick, below));
    }

    function _disarm(bytes32 pool, uint256 tokenId) internal {
        IReactive.LogRecord memory log_ = _armLog(pool, tokenId, 0, true);
        log_.topic0 = uint256(RipcordVault.LineDisarmed.selector);
        log_.data = "";
        vm.prank(SYSTEM);
        rc.react(log_);
    }

    function _swap(bytes32 pool, int24 tick) internal {
        vm.prank(SYSTEM);
        rc.react(_swapLog(pool, tick));
    }

    function _armLog(bytes32 pool, uint256 tokenId, int24 tick, bool below)
        internal
        pure
        returns (IReactive.LogRecord memory)
    {
        return IReactive.LogRecord({
            chainId: POOL_CHAIN,
            contractAddress: VAULT,
            topic0: uint256(RipcordVault.LineArmed.selector),
            topic1: uint256(pool),
            topic2: tokenId,
            topic3: uint256(uint160(address(0x0E0))),
            data: abi.encode(tick, below),
            blockNumber: 100,
            opCode: 4,
            blockHash: 0,
            txHash: uint256(keccak256("arm-tx")),
            logIndex: 0
        });
    }

    function _swapLog(bytes32 pool, int24 tick) internal pure returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chainId: POOL_CHAIN,
            contractAddress: POOL_MANAGER,
            topic0: uint256(IPoolManager.Swap.selector),
            topic1: uint256(pool),
            topic2: uint256(uint160(address(0x5A5))),
            topic3: 0,
            data: abi.encode(
                int128(-1e18), int128(1e18), uint160(79228162514264337593543950336), uint128(1e20), tick, uint24(3000)
            ),
            blockNumber: 777,
            opCode: 3,
            blockHash: 0,
            txHash: uint256(keccak256("swap-tx")),
            logIndex: 0
        });
    }
}
