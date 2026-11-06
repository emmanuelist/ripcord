// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IReactive} from "reactive-lib-omni/interfaces/IReactive.sol";
import {ISystemContract} from "reactive-lib-omni/interfaces/ISystemContract.sol";
import {AbstractPayer} from "reactive-lib-omni/base/AbstractPayer.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {ExitTriggerSource} from "../../src/spike/ExitTriggerSource.sol";
import {ExitProbe} from "../../src/spike/ExitProbe.sol";
import {ExitReactive} from "../../src/spike/ExitReactive.sol";
import {TestToken} from "../../src/spike/TestToken.sol";
import {SystemStub} from "../utils/SystemStub.sol";
import {OBSERVED_PROXY_OVERHEAD_GAS} from "../utils/ReactiveBudget.sol";

contract S2ReactiveTest is Test {
    address internal constant SYSTEM = 0x8888888888888888888888888888888888888888;
    uint256 internal constant REACTIVE_IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad;
    uint256 internal constant POOL_CHAIN = 1301;
    address internal constant PROXY = address(0xC0FFEE);
    /// @dev Full exit measured on a fork of live Unichain Sepolia (E-004).
    uint256 internal constant MEASURED_EXIT_GAS = 196_497;

    SystemStub internal sys;
    ExitTriggerSource internal trigger;
    ExitProbe internal probe;
    ExitReactive internal rc;

    function setUp() public {
        vm.etch(SYSTEM, address(new SystemStub()).code);
        sys = SystemStub(payable(SYSTEM));
        trigger = new ExitTriggerSource();
        address expected = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        probe = new ExitProbe(PROXY, expected, IPositionManager(address(0xB0B)), address(this));
        rc = new ExitReactive(POOL_CHAIN, address(trigger), address(probe));
        assertEq(address(rc), expected);
    }

    function test_SubscribesToExitRequestsFromTriggerOnly() public view {
        (uint256 chainId, address emitter, uint256 t0, uint256 t1, uint256 t2, uint256 t3) = sys.subscriptions(0);
        assertEq(chainId, POOL_CHAIN);
        assertEq(emitter, address(trigger));
        assertEq(t0, uint256(ExitTriggerSource.ExitRequested.selector));
        assertEq(t1, REACTIVE_IGNORE);
        assertEq(t2, REACTIVE_IGNORE);
        assertEq(t3, REACTIVE_IGNORE);
    }

    function test_ReactRequestsExitCallbackForTheTokenId() public {
        vm.prank(SYSTEM);
        rc.react(_exitLog(42));
        ISystemContract.CallbackConfiguration_V_1_0 memory req = sys.request(0);
        assertEq(req.chainId, POOL_CHAIN);
        assertEq(req.recipient, address(probe));
        assertEq(req.payload, abi.encodeCall(ExitProbe.exit, (address(0), 42)));
    }

    function test_CallbackBudgetCoversMeasuredExitTwice() public view {
        assertGe(uint256(rc.CALLBACK_GAS()) - OBSERVED_PROXY_OVERHEAD_GAS, 2 * MEASURED_EXIT_GAS);
    }

    function test_ReactRejectsAnyoneButSystem() public {
        IReactive.LogRecord memory log_ = _exitLog(1);
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, address(this), SYSTEM));
        rc.react(log_);
    }

    function test_ReactRejectsForeignEmitter() public {
        IReactive.LogRecord memory log_ = _exitLog(1);
        log_.contractAddress = address(0xBAD);
        vm.prank(SYSTEM);
        vm.expectRevert(
            abi.encodeWithSelector(ExitReactive.UnexpectedLog.selector, POOL_CHAIN, address(0xBAD), log_.topic0)
        );
        rc.react(log_);
    }

    function test_ConstructorRejectsZeroAddresses() public {
        vm.expectRevert(ExitReactive.ZeroAddress.selector);
        new ExitReactive(POOL_CHAIN, address(0), address(probe));
        vm.expectRevert(ExitReactive.ZeroAddress.selector);
        new ExitReactive(POOL_CHAIN, address(trigger), address(0));
    }

    function test_TestTokenOnlyMinterMints() public {
        TestToken t = new TestToken("Ripcord Test A", "RTA");
        t.mint(address(this), 1e18);
        assertEq(t.balanceOf(address(this)), 1e18);
        vm.prank(address(0xBEEF));
        vm.expectRevert(TestToken.NotMinter.selector);
        t.mint(address(0xBEEF), 1);
    }

    function _exitLog(uint256 tokenId) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chainId: POOL_CHAIN,
            contractAddress: address(trigger),
            topic0: uint256(ExitTriggerSource.ExitRequested.selector),
            topic1: tokenId,
            topic2: uint256(uint160(address(this))),
            topic3: 0,
            data: "",
            blockNumber: 7,
            opCode: 3,
            blockHash: 0,
            txHash: uint256(keccak256("origin")),
            logIndex: 0
        });
    }
}
