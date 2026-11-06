// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console} from "forge-std/Script.sol";
import {PingSource} from "../../src/spike/PingSource.sol";
import {PongSink} from "../../src/spike/PongSink.sol";
import {PingReactive} from "../../src/spike/PingReactive.sol";

/// @notice Step 1 of spike S1, on the pool chain: deploys PingSource and a funded PongSink.
/// PongSink must know the Lasna reactive contract's address up front, so `EXPECTED_REACTIVE` is precomputed from the
/// deployer's Lasna nonce by script/spike/s1-deploy.sh. Don't send any Lasna tx between the two steps.
contract DeployS1Pool is Script {
    function run() external {
        uint256 poolChainId = vm.envUint("POOL_CHAIN_ID");
        address proxy = vm.envAddress("CALLBACK_PROXY");
        address expectedReactive = vm.envAddress("EXPECTED_REACTIVE");
        uint256 funding = vm.envOr("PONG_FUNDING_WEI", uint256(0.002 ether));
        require(block.chainid == poolChainId, "connected to the wrong pool chain");

        vm.startBroadcast();
        PingSource source = new PingSource();
        PongSink sink = new PongSink{value: funding}(proxy, expectedReactive);
        vm.stopBroadcast();

        console.log("PingSource", address(source));
        console.log("PongSink  ", address(sink));
    }
}

/// @notice Step 2 of spike S1, on Reactive Lasna: deploys the funded PingReactive at the precomputed address.
contract DeployS1Reactive is Script {
    uint256 internal constant LASNA_CHAIN_ID = 5318007;

    function run() external {
        uint256 poolChainId = vm.envUint("POOL_CHAIN_ID");
        address source = vm.envAddress("PING_SOURCE");
        address sink = vm.envAddress("PONG_SINK");
        address expectedReactive = vm.envAddress("EXPECTED_REACTIVE");
        uint256 funding = vm.envOr("REACTIVE_FUNDING_WEI", uint256(0.5 ether));
        require(block.chainid == LASNA_CHAIN_ID, "connected to the wrong network: expected Lasna");

        vm.startBroadcast();
        PingReactive rc = new PingReactive{value: funding}(poolChainId, source, poolChainId, sink);
        vm.stopBroadcast();

        // Checked in simulation, before anything is broadcast: a mismatch means PongSink expects another address.
        require(address(rc) == expectedReactive, "PingReactive address differs from the precomputed one");
        console.log("PingReactive", address(rc));
    }
}
