// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {TestToken} from "../../src/spike/TestToken.sol";
import {ExitTriggerSource} from "../../src/spike/ExitTriggerSource.sol";
import {ExitProbe} from "../../src/spike/ExitProbe.sol";
import {ExitReactive} from "../../src/spike/ExitReactive.sol";

/// @dev Unichain Sepolia v4 addresses (docs/CONTEXT.md, bytecode verified in E-001).
abstract contract UnichainV4 {
    IPoolManager internal constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    IPositionManager internal constant POSM = IPositionManager(0xf969Aee60879C54bAAed9F3eD26147Db216Fd664);
    IAllowanceTransfer internal constant PERMIT2 = IAllowanceTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    address internal constant CALLBACK_PROXY = 0x775c9B990ADe401060B78D0e98684eEf8d2466C1;
    uint256 internal constant UNICHAIN_SEPOLIA = 1301;
}

/// @notice Step 1: a disclosed test-token pair, a real v4 pool on the live PoolManager, and one position owned by
/// the deployer. The tokenId is read from the ERC721 Transfer in the receipts by s2-run.sh.
contract SetupS2Position is Script, UnichainV4 {
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        require(block.chainid == UNICHAIN_SEPOLIA, "expected Unichain Sepolia");

        vm.startBroadcast();
        TestToken a = new TestToken("Ripcord Test A", "RTA");
        TestToken b = new TestToken("Ripcord Test B", "RTB");
        (TestToken t0, TestToken t1) = address(a) < address(b) ? (a, b) : (b, a);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(t0)),
            currency1: Currency.wrap(address(t1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        POOL_MANAGER.initialize(key, SQRT_PRICE_1_1);
        for (uint256 i = 0; i < 2; ++i) {
            TestToken t = i == 0 ? t0 : t1;
            t.mint(deployer, 1_000e18);
            t.approve(address(PERMIT2), type(uint256).max);
            PERMIT2.approve(address(t), address(POSM), type(uint160).max, type(uint48).max);
        }
        // Action codes are constants 0x02 and 0x0d, so the uint8 casts can't truncate.
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            key, int24(-600), int24(600), uint256(100e18), type(uint128).max, type(uint128).max, deployer, bytes("")
        );
        params[1] = abi.encode(key.currency0, key.currency1);
        POSM.modifyLiquidities(abi.encode(actions, params), block.timestamp + 300);
        vm.stopBroadcast();

        console.log("token0", address(t0));
        console.log("token1", address(t1));
    }
}

/// @notice Step 2, Unichain Sepolia: the trigger source and a funded ExitProbe that pays exits to the deployer.
contract DeployS2Pool is Script, UnichainV4 {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address expectedReactive = vm.envAddress("EXPECTED_REACTIVE");
        uint256 funding = vm.envOr("PROBE_FUNDING_WEI", uint256(0.001 ether));
        require(block.chainid == UNICHAIN_SEPOLIA, "expected Unichain Sepolia");

        vm.startBroadcast();
        ExitTriggerSource trigger = new ExitTriggerSource();
        ExitProbe probe = new ExitProbe{value: funding}(CALLBACK_PROXY, expectedReactive, POSM, deployer);
        vm.stopBroadcast();

        console.log("ExitTriggerSource", address(trigger));
        console.log("ExitProbe", address(probe));
    }
}

/// @notice Step 3, Lasna: the funded ExitReactive at the precomputed address.
contract DeployS2Reactive is Script {
    function run() external {
        address trigger = vm.envAddress("TRIGGER_SOURCE");
        address probe = vm.envAddress("EXIT_PROBE");
        address expectedReactive = vm.envAddress("EXPECTED_REACTIVE");
        uint256 funding = vm.envOr("REACTIVE_FUNDING_WEI", uint256(0.5 ether));
        require(block.chainid == 5318007, "expected Lasna");

        vm.startBroadcast();
        ExitReactive rc = new ExitReactive{value: funding}(1301, trigger, probe);
        vm.stopBroadcast();

        require(address(rc) == expectedReactive, "ExitReactive address differs from the precomputed one");
        console.log("ExitReactive", address(rc));
    }
}
