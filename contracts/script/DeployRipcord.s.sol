// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {TestToken} from "../src/spike/TestToken.sol";
import {RipcordVault} from "../src/RipcordVault.sol";
import {RipcordReactive} from "../src/RipcordReactive.sol";

/// @dev Unichain Sepolia addresses (docs/CONTEXT.md, bytecode verified in E-001).
abstract contract Unichain {
    IPoolManager internal constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    IPositionManager internal constant POSM = IPositionManager(0xf969Aee60879C54bAAed9F3eD26147Db216Fd664);
    IAllowanceTransfer internal constant PERMIT2 = IAllowanceTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    address internal constant SWAP_ROUTER = 0x9140a78c1A137c7fF1c151EC8231272aF78a99A4; // v4 PoolSwapTest
    address internal constant CALLBACK_PROXY = 0x775c9B990ADe401060B78D0e98684eEf8d2466C1;
    uint256 internal constant UNICHAIN_SEPOLIA = 1301;

    function _key(address token0, address token1) internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }
}

/// @notice The demo pool: a disclosed test-token pair on the real PoolManager. It mints the deployer a working balance
/// and approves the PositionManager (via Permit2) and the swap router.
contract SetupDemoPool is Script, Unichain {
    using PoolIdLibrary for PoolKey;

    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        require(block.chainid == UNICHAIN_SEPOLIA, "expected Unichain Sepolia");
        vm.startBroadcast();
        TestToken a = new TestToken("Ripcord Demo A", "RDA");
        TestToken b = new TestToken("Ripcord Demo B", "RDB");
        (TestToken t0, TestToken t1) = address(a) < address(b) ? (a, b) : (b, a);
        PoolKey memory key = _key(address(t0), address(t1));
        POOL_MANAGER.initialize(key, 79228162514264337593543950336); // price 1:1, tick 0
        for (uint256 i = 0; i < 2; ++i) {
            TestToken t = i == 0 ? t0 : t1;
            t.mint(deployer, 10_000_000e18);
            t.approve(address(PERMIT2), type(uint256).max);
            PERMIT2.approve(address(t), address(POSM), type(uint160).max, type(uint48).max);
            t.approve(SWAP_ROUTER, type(uint256).max);
        }
        vm.stopBroadcast();
        console.log("token0", address(t0));
        console.log("token1", address(t1));
        console.logBytes32(PoolId.unwrap(key.toId()));
    }
}

/// @notice A fresh demo position owned by the deployer, ticks -6000..6000. The tokenId comes from the receipt.
contract MintDemoPosition is Script, Unichain {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        PoolKey memory key = _key(vm.envAddress("TOKEN0"), vm.envAddress("TOKEN1"));
        uint256 liquidity = vm.envOr("LIQUIDITY", uint256(1_000e18));
        require(block.chainid == UNICHAIN_SEPOLIA, "expected Unichain Sepolia");
        // Action codes are the constants 0x02 and 0x0d, so the uint8 casts can't truncate.
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] =
            abi.encode(key, int24(-6000), int24(6000), liquidity, type(uint128).max, type(uint128).max, deployer, "");
        params[1] = abi.encode(key.currency0, key.currency1);
        vm.startBroadcast();
        POSM.modifyLiquidities(abi.encode(actions, params), block.timestamp + 300);
        vm.stopBroadcast();
    }
}

/// @notice RipcordVault on Unichain Sepolia, trusting only the precomputed RipcordReactive address.
contract DeployRipcordVault is Script, Unichain {
    function run() external {
        address expectedReactive = vm.envAddress("EXPECTED_REACTIVE");
        uint256 funding = vm.envOr("VAULT_FUNDING_WEI", uint256(0.001 ether));
        require(block.chainid == UNICHAIN_SEPOLIA, "expected Unichain Sepolia");
        vm.startBroadcast();
        RipcordVault vault = new RipcordVault{value: funding}(CALLBACK_PROXY, expectedReactive, POOL_MANAGER, POSM);
        vm.stopBroadcast();
        console.log("RipcordVault", address(vault));
    }
}

/// @notice RipcordReactive on Lasna at the precomputed address. Checked in simulation, before anything is broadcast.
contract DeployRipcordReactive is Script, Unichain {
    function run() external {
        address vault = vm.envAddress("VAULT");
        address expectedReactive = vm.envAddress("EXPECTED_REACTIVE");
        uint256 funding = vm.envOr("REACTIVE_FUNDING_WEI", uint256(1 ether));
        require(block.chainid == 5318007, "expected Lasna");
        vm.startBroadcast();
        RipcordReactive rc = new RipcordReactive{value: funding}(UNICHAIN_SEPOLIA, address(POOL_MANAGER), vault);
        vm.stopBroadcast();
        require(address(rc) == expectedReactive, "RipcordReactive address differs from the precomputed one");
        console.log("RipcordReactive", address(rc));
    }
}
