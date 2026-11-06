// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Vm} from "forge-std/Test.sol";
import {AbstractPayer} from "reactive-lib-omni/base/AbstractPayer.sol";
import {AbstractCallback} from "reactive-lib-omni/base/AbstractCallback.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {RipcordVault} from "../src/RipcordVault.sol";
import {V4Fork} from "./utils/V4Fork.sol";
import {OBSERVED_PROXY_OVERHEAD_GAS} from "./utils/ReactiveBudget.sol";

interface IERC721Ops {
    function approve(address spender, uint256 id) external;
    function setApprovalForAll(address operator, bool approved) external;
    function transferFrom(address from, address to, uint256 id) external;
    function ownerOf(uint256 id) external view returns (address);
}

/// @dev TEST FIXTURE: accepts any subscriber notification, used to give a position a subscriber.
contract AcceptAllSubscriber {
    fallback() external {}
}

/// @notice RipcordVault against the live Unichain Sepolia v4 deployment (fork). The only stand-ins: the Reactive proxy
/// is impersonated with vm.prank at its real address, and REACTIVE stands in for RipcordReactive's Lasna address.
contract RipcordVaultForkTest is V4Fork {
    address internal constant REACTIVE = address(0xA11CE);
    uint64 internal constant CALLBACK_GAS = 1_000_000;

    RipcordVault internal vault;
    address internal lp = makeAddr("lp");
    address internal trader = makeAddr("trader");
    uint256 internal tokenId;

    function setUp() public {
        _forkPool();
        vault = new RipcordVault(PROXY, REACTIVE, POOL_MANAGER, POSM);
        _fund(lp);
        _fund(trader);
        tokenId = _mint(lp, 1_000e18);
        vm.prank(lp);
        IERC721Ops(address(POSM)).approve(address(vault), tokenId);
    }

    // ---- arm ----

    function test_ArmRecordsLineAndEmitsForTheReactiveContract() public {
        vm.expectEmit(true, true, true, true, address(vault));
        emit RipcordVault.LineArmed(poolId, tokenId, lp, -120, true);
        vm.prank(lp);
        vault.arm(tokenId, -120, true);
        (address owner, PoolId pid, int24 trigger, bool below, RipcordVault.Status status) = vault.lines(tokenId);
        assertEq(owner, lp);
        assertEq(PoolId.unwrap(pid), PoolId.unwrap(poolId));
        assertEq(trigger, -120);
        assertTrue(below);
        assertEq(uint8(status), uint8(RipcordVault.Status.Armed));
        assertEq(vault.armedInPool(poolId), 1);
    }

    function test_ArmWorksWithApprovalForAll() public {
        uint256 other = _mint(lp, 1e18);
        vm.startPrank(lp);
        IERC721Ops(address(POSM)).setApprovalForAll(address(vault), true);
        vault.arm(other, -120, true);
        vm.stopPrank();
    }

    function test_ArmRejectsNonOwner() public {
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(RipcordVault.NotOwner.selector, tokenId, trader));
        vault.arm(tokenId, -120, true);
    }

    function test_ArmRejectsUnapprovedVault() public {
        uint256 other = _mint(lp, 1e18);
        vm.prank(lp);
        vm.expectRevert(abi.encodeWithSelector(RipcordVault.VaultNotApproved.selector, other));
        vault.arm(other, -120, true);
    }

    function test_ArmRejectsSubscribedPosition() public {
        vm.startPrank(lp);
        POSM.subscribe(tokenId, address(new AcceptAllSubscriber()), "");
        vm.expectRevert(abi.encodeWithSelector(RipcordVault.HasSubscriber.selector, tokenId));
        vault.arm(tokenId, -120, true);
        vm.stopPrank();
    }

    function test_ArmRejectsLineAlreadyCrossed() public {
        // The pool starts at tick 0, so "exit at or below +60" is already true.
        vm.prank(lp);
        vm.expectRevert(abi.encodeWithSelector(RipcordVault.LineAlreadyCrossed.selector, int24(0), int24(60), true));
        vault.arm(tokenId, 60, true);
    }

    function test_ArmRejectsTickOutOfRange() public {
        vm.prank(lp);
        vm.expectRevert(abi.encodeWithSelector(RipcordVault.TickOutOfRange.selector, int24(-887273)));
        vault.arm(tokenId, -887273, true);
    }

    function test_ReArmDoesNotDoubleCount() public {
        vm.startPrank(lp);
        vault.arm(tokenId, -120, true);
        vault.arm(tokenId, -240, true);
        vm.stopPrank();
        assertEq(vault.armedInPool(poolId), 1);
    }

    function test_NinthLineInPoolIsRefused() public {
        vm.startPrank(lp);
        IERC721Ops(address(POSM)).setApprovalForAll(address(vault), true);
        vm.stopPrank();
        vm.prank(lp);
        vault.arm(tokenId, -120, true);
        for (uint256 i = 0; i < 7; ++i) {
            uint256 id = _mint(lp, 1e18);
            vm.prank(lp);
            vault.arm(id, -120, true);
        }
        uint256 ninth = _mint(lp, 1e18);
        vm.prank(lp);
        vm.expectRevert(abi.encodeWithSelector(RipcordVault.PoolFull.selector, poolId));
        vault.arm(ninth, -120, true);
    }

    // ---- exit: the thesis path ----

    function test_RealSwapCrossesLineAndCallbackPullsAllLiquidity() public {
        vm.prank(lp);
        vault.arm(tokenId, -120, true);
        _swap(trader, true, 50e18); // push the price down through the line
        int24 tick = _tick();
        assertLe(tick, -120, "the swap didn't cross the line");

        uint256 before0 = t0.balanceOf(lp);
        uint256 before1 = t1.balanceOf(lp);
        vm.recordLogs();
        bool ok = _deliver(tokenId, tick);
        assertTrue(ok, "exit reverted inside the proxy's forwarded budget");

        assertEq(POSM.getPositionLiquidity(tokenId), 0, "liquidity left in the pool");
        assertGt(t0.balanceOf(lp), before0);
        assertGt(t1.balanceOf(lp), before1);
        assertEq(IERC721Ops(address(POSM)).ownerOf(tokenId), lp, "owner keeps the NFT");
        (,,,, RipcordVault.Status status) = vault.lines(tokenId);
        assertEq(uint8(status), uint8(RipcordVault.Status.Exited));
        assertEq(vault.armedInPool(poolId), 0);
        assertTrue(_emitted(RipcordVault.Exited.selector), "no Exited event");
    }

    function test_CrossingUpwardsExitsToo() public {
        vm.prank(lp);
        vault.arm(tokenId, 180, false);
        _swap(trader, false, 50e18); // push the price up
        assertTrue(_deliver(tokenId, _tick()));
        assertEq(POSM.getPositionLiquidity(tokenId), 0);
    }

    // ---- exit: who may pull it, and when ----

    function test_ExitRejectsDirectCaller() public {
        vm.prank(lp);
        vault.arm(tokenId, -120, true);
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, address(this), PROXY));
        vault.exit(REACTIVE, tokenId, -200, 1, 1);
    }

    /// @notice The reversal beat: a callback relayed for any other reactive contract is refused.
    function test_ExitRejectsForeignReactiveContract() public {
        vm.prank(lp);
        vault.arm(tokenId, -120, true);
        address impostor = address(0xBEEF);
        vm.prank(PROXY);
        vm.expectRevert(abi.encodeWithSelector(AbstractCallback.CallbackNotAuthorized.selector, impostor, REACTIVE));
        vault.exit(impostor, tokenId, -200, 1, 1);
        assertEq(POSM.getPositionLiquidity(tokenId), 1_000e18);
    }

    function test_ExitRejectsATickThatDoesNotCross() public {
        vm.prank(lp);
        vault.arm(tokenId, -120, true);
        vm.prank(PROXY);
        vm.expectRevert(
            abi.encodeWithSelector(RipcordVault.LineNotCrossed.selector, tokenId, int24(-119), int24(-120), true)
        );
        vault.exit(REACTIVE, tokenId, -119, 1, 1);
    }

    function test_ExitRejectsUnarmedAndSecondExit() public {
        vm.prank(PROXY);
        vm.expectRevert(abi.encodeWithSelector(RipcordVault.NotArmed.selector, tokenId, RipcordVault.Status.None));
        vault.exit(REACTIVE, tokenId, -200, 1, 1);

        vm.prank(lp);
        vault.arm(tokenId, -120, true);
        assertTrue(_deliver(tokenId, -200));
        vm.prank(PROXY);
        vm.expectRevert(abi.encodeWithSelector(RipcordVault.NotArmed.selector, tokenId, RipcordVault.Status.Exited));
        vault.exit(REACTIVE, tokenId, -200, 1, 1);
    }

    function test_DisarmedLineCannotBePulled() public {
        vm.startPrank(lp);
        vault.arm(tokenId, -120, true);
        vault.disarm(tokenId);
        vm.stopPrank();
        assertEq(vault.armedInPool(poolId), 0);
        vm.prank(PROXY);
        vm.expectRevert(abi.encodeWithSelector(RipcordVault.NotArmed.selector, tokenId, RipcordVault.Status.Disarmed));
        vault.exit(REACTIVE, tokenId, -200, 1, 1);
    }

    function test_OnlyOwnerCanDisarm() public {
        vm.prank(lp);
        vault.arm(tokenId, -120, true);
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(RipcordVault.NotOwner.selector, tokenId, trader));
        vault.disarm(tokenId);
    }

    function test_PerformExitIsSelfOnly() public {
        vm.expectRevert(RipcordVault.OnlySelf.selector);
        vault.performExit(tokenId);
    }

    // ---- exit: failures are reported, not swallowed (D-010) ----

    function test_RevokedApprovalBecomesExitFailed() public {
        vm.startPrank(lp);
        vault.arm(tokenId, -120, true);
        IERC721Ops(address(POSM)).approve(address(0), tokenId);
        vm.stopPrank();
        vm.recordLogs();
        assertTrue(_deliver(tokenId, -200), "the callback itself must not revert");
        assertTrue(_emitted(RipcordVault.ExitFailed.selector), "no ExitFailed event");
        (,,,, RipcordVault.Status status) = vault.lines(tokenId);
        assertEq(uint8(status), uint8(RipcordVault.Status.Failed));
        assertEq(POSM.getPositionLiquidity(tokenId), 1_000e18, "liquidity must be untouched");
        assertEq(vault.armedInPool(poolId), 0);
    }

    function test_MovedNftBecomesExitFailed() public {
        vm.startPrank(lp);
        vault.arm(tokenId, -120, true);
        IERC721Ops(address(POSM)).transferFrom(lp, trader, tokenId);
        vm.stopPrank();
        vm.recordLogs();
        assertTrue(_deliver(tokenId, -200));
        assertTrue(_emitted(RipcordVault.ExitFailed.selector));
        assertEq(POSM.getPositionLiquidity(tokenId), 1_000e18);
    }

    function test_SubscriberAddedAfterArmingBecomesExitFailed() public {
        vm.startPrank(lp);
        vault.arm(tokenId, -120, true);
        POSM.subscribe(tokenId, address(new AcceptAllSubscriber()), "");
        vm.stopPrank();
        vm.recordLogs();
        assertTrue(_deliver(tokenId, -200));
        assertTrue(_emitted(RipcordVault.ExitFailed.selector));
        assertEq(POSM.getPositionLiquidity(tokenId), 1_000e18);
    }

    // ---- helpers ----

    /// @dev Delivers the exit exactly as the proxy would: from its address, with Reactive's injected sender, inside the
    /// gas the proxy actually forwards from a CALLBACK_GAS request.
    function _deliver(uint256 id, int24 tick) internal returns (bool ok) {
        bytes memory payload = abi.encodeCall(RipcordVault.exit, (REACTIVE, id, tick, 123, uint256(keccak256("swap"))));
        vm.prank(PROXY);
        (ok,) = address(vault).call{gas: CALLBACK_GAS - OBSERVED_PROXY_OVERHEAD_GAS}(payload);
    }

    function _emitted(bytes32 topic0) internal view returns (bool) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; ++i) {
            if (logs[i].emitter == address(vault) && logs[i].topics[0] == topic0) return true;
        }
        return false;
    }
}
