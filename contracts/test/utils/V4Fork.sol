// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {TestToken} from "../../src/spike/TestToken.sol";

/// @notice A fork of LIVE Unichain Sepolia with a fresh pool of disclosed test tokens on the real PoolManager. Positions
/// are minted by the real PositionManager, and swaps go through the deployed PoolSwapTest router. Nothing in Uniswap is
/// redeployed or mocked.
abstract contract V4Fork is Test {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // docs/CONTEXT.md, bytecode verified in E-001.
    IPoolManager internal constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    IPositionManager internal constant POSM = IPositionManager(0xf969Aee60879C54bAAed9F3eD26147Db216Fd664);
    IAllowanceTransfer internal constant PERMIT2 = IAllowanceTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    PoolSwapTest internal constant SWAP_ROUTER = PoolSwapTest(0x9140a78c1A137c7fF1c151EC8231272aF78a99A4);
    address internal constant PROXY = 0x775c9B990ADe401060B78D0e98684eEf8d2466C1;
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    PoolKey internal key;
    PoolId internal poolId;
    TestToken internal t0;
    TestToken internal t1;

    function _forkPool() internal {
        vm.createSelectFork(vm.envOr("UNICHAIN_SEPOLIA_RPC", string("https://sepolia.unichain.org")));
        TestToken a = new TestToken("Ripcord Test A", "RTA");
        TestToken b = new TestToken("Ripcord Test B", "RTB");
        (t0, t1) = address(a) < address(b) ? (a, b) : (b, a);
        key = PoolKey({
            currency0: Currency.wrap(address(t0)),
            currency1: Currency.wrap(address(t1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        poolId = key.toId();
        POOL_MANAGER.initialize(key, SQRT_PRICE_1_1);
    }

    /// @dev Funds `who` and approves both the PositionManager (via Permit2) and the swap router.
    function _fund(address who) internal {
        for (uint256 i = 0; i < 2; ++i) {
            TestToken t = i == 0 ? t0 : t1;
            t.mint(who, 1_000_000e18);
            vm.startPrank(who);
            t.approve(address(PERMIT2), type(uint256).max);
            PERMIT2.approve(address(t), address(POSM), type(uint160).max, type(uint48).max);
            t.approve(address(SWAP_ROUTER), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _mint(address owner, uint256 liquidity) internal returns (uint256 tokenId) {
        tokenId = POSM.nextTokenId();
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            key, int24(-6000), int24(6000), liquidity, type(uint128).max, type(uint128).max, owner, bytes("")
        );
        params[1] = abi.encode(key.currency0, key.currency1);
        vm.prank(owner);
        POSM.modifyLiquidities(abi.encode(actions, params), block.timestamp + 60);
    }

    /// @dev An exact-input swap by `trader`. zeroForOne pushes the tick down; oneForZero pushes it up.
    function _swap(address trader, bool zeroForOne, uint256 amountIn) internal {
        vm.prank(trader);
        SWAP_ROUTER.swap(
            key,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            bytes("")
        );
    }

    function _tick() internal view returns (int24 tick) {
        (, tick,,) = POOL_MANAGER.getSlot0(poolId);
    }
}
