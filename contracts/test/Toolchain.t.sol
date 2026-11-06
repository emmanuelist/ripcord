// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {AbstractReactive} from "reactive-lib-omni/base/AbstractReactive.sol";
import {IReactive} from "reactive-lib-omni/interfaces/IReactive.sol";
import {ISystemContract} from "reactive-lib-omni/interfaces/ISystemContract.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";

/// @dev Exposes reactive-lib-omni internals so the pinned values can be asserted.
contract OmniProbe is AbstractReactive {
    function system() external pure returns (address) {
        return address(SYSTEM);
    }

    function ignore() external pure returns (uint256) {
        return REACTIVE_IGNORE;
    }

    function react(IReactive.LogRecord calldata) external onlySystem {}
}

/// @notice Pins the dependency facts recorded in docs/CONTEXT.md (verified on-chain in E-001).
/// A library bump that changes any of them fails the gate instead of failing on testnet.
contract ToolchainTest is Test {
    OmniProbe internal probe;

    function setUp() public {
        probe = new OmniProbe();
    }

    function test_OmniSystemContractAddress() public view {
        assertEq(probe.system(), 0x8888888888888888888888888888888888888888);
    }

    function test_OmniWildcardTopic() public view {
        assertEq(probe.ignore(), 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad);
    }

    function test_ReactOnlyAcceptsSystem() public {
        IReactive.LogRecord memory log;
        vm.expectRevert();
        probe.react(log);
        vm.prank(0x8888888888888888888888888888888888888888);
        probe.react(log);
    }

    function test_CallbackRequestSelector() public pure {
        assertEq(
            ISystemContract.requestCallbackV_1_0.selector,
            bytes4(keccak256("requestCallbackV_1_0((uint256,address,uint64,bytes))"))
        );
    }

    function test_V4SwapTopic() public pure {
        assertEq(IPoolManager.Swap.selector, 0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f);
    }

    function test_PositionManagerSelectorsMatchDeployedBytecode() public pure {
        // Each selector was found in the deployed PositionManager on Unichain and Base Sepolia (E-001).
        assertEq(IPositionManager.modifyLiquidities.selector, bytes4(0xdd46508f));
        assertEq(IPositionManager.getPoolAndPositionInfo.selector, bytes4(0x7ba03aad));
        assertEq(IPositionManager.getPositionLiquidity.selector, bytes4(0x1efeed33));
        assertEq(IPositionManager.nextTokenId.selector, bytes4(0x75794a3c));
    }

    function test_PositionManagerActionCodes() public pure {
        assertEq(Actions.DECREASE_LIQUIDITY, 0x01);
        assertEq(Actions.BURN_POSITION, 0x03);
        assertEq(Actions.TAKE_PAIR, 0x11);
        assertEq(Actions.CLOSE_CURRENCY, 0x12);
    }
}
