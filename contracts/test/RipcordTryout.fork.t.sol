// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {RipcordVault} from "../src/RipcordVault.sol";
import {RipcordTryout} from "../src/RipcordTryout.sol";
import {V4Fork} from "./utils/V4Fork.sol";

interface IOwnerOf {
    function ownerOf(uint256 id) external view returns (address);
}

/// @notice RipcordTryout on a fork of live Unichain Sepolia: the real PositionManager, PoolManager and PoolSwapTest.
contract RipcordTryoutForkTest is V4Fork {
    address internal constant REACTIVE = address(0xA11CE);

    RipcordVault internal vault;
    RipcordTryout internal tryout;
    address internal judge = makeAddr("judge");

    function setUp() public {
        _forkPool();
        vault = new RipcordVault(PROXY, REACTIVE, POOL_MANAGER, POSM);
        tryout = new RipcordTryout(vault, POOL_MANAGER, POSM, PERMIT2, SWAP_ROUTER, key.currency0, key.currency1);
        t0.mint(address(tryout), 1_000_000e18);
        t1.mint(address(tryout), 1_000_000e18);
    }

    function test_ArmMintsAPositionAndArmsALineOneSpacingAway() public {
        vm.prank(judge);
        (uint256 id, int24 line, bool below) = tryout.arm();
        assertEq(IOwnerOf(address(POSM)).ownerOf(id), address(tryout));
        assertTrue(below);
        assertEq(line, _tick() - 60);
        (address owner,, int24 trigger, bool exitBelow, RipcordVault.Status status) = vault.lines(id);
        assertEq(owner, address(tryout));
        assertEq(trigger, line);
        assertTrue(exitBelow);
        assertEq(uint8(status), uint8(RipcordVault.Status.Armed));
        (address by,,,) = tryout.tryouts(id);
        assertEq(by, judge);
    }

    function test_CrossEndsJustPastTheLine() public {
        (uint256 id, int24 line,) = tryout.arm();
        int24 tickAfter = tryout.cross(id);
        assertLe(tickAfter, line);
        assertGe(tickAfter, line - tryout.CROSS_BY());
        assertEq(_tick(), tickAfter);
    }

    /// Regression for 2026-11-14: extra liquidity in range stopped a fixed-size swap short of the line.
    function test_CrossCrossesEvenUnderHeavyLiquidity() public {
        address whale = makeAddr("whale");
        _fund(whale);
        _mint(whale, 300_000e18);
        (uint256 id, int24 line,) = tryout.arm();
        assertLe(tryout.cross(id), line);
    }

    function test_DirectionsAlternateSoThePriceOscillates() public {
        (uint256 first,,) = tryout.arm();
        tryout.cross(first);
        vm.warp(block.timestamp + 61);
        int24 tickNow = _tick();
        (uint256 second, int24 line, bool below) = tryout.arm();
        assertFalse(below);
        assertEq(line, tickNow + 60);
        assertGe(tryout.cross(second), line);
    }

    function test_ASecondArmWithinTheCooldownIsRefused() public {
        tryout.arm();
        vm.expectRevert(abi.encodeWithSelector(RipcordTryout.CoolingDown.selector, block.timestamp + 60));
        tryout.arm();
    }

    function test_OnlyTheOwnerClosesItAndClosedRefusesArms() public {
        vm.prank(judge);
        vm.expectRevert(RipcordTryout.NotOwner.selector);
        tryout.setOpen(false);
        tryout.setOpen(false);
        vm.expectRevert(RipcordTryout.Closed.selector);
        tryout.arm();
    }

    function test_CrossRefusesUnknownAndRepeatedTryouts() public {
        vm.expectRevert(abi.encodeWithSelector(RipcordTryout.NotATryout.selector, 123));
        tryout.cross(123);
        (uint256 id,,) = tryout.arm();
        tryout.cross(id);
        vm.expectRevert(abi.encodeWithSelector(RipcordTryout.AlreadyCrossed.selector, id));
        tryout.cross(id);
    }

    function test_TheExitPaysTheTokensBackToTheTryout() public {
        (uint256 id,,) = tryout.arm();
        int24 tickAfter = tryout.cross(id);
        uint256 before0 = t0.balanceOf(address(tryout));
        uint256 before1 = t1.balanceOf(address(tryout));
        vm.prank(PROXY);
        vault.exit(REACTIVE, id, tickAfter, block.number, 1);
        assertEq(POSM.getPositionLiquidity(id), 0);
        assertGt(t0.balanceOf(address(tryout)) + t1.balanceOf(address(tryout)), before0 + before1);
    }
}
