// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ISystemContract} from "reactive-lib-omni/interfaces/ISystemContract.sol";

/// @notice TEST DOUBLE ONLY (D-004). Stands in for the Omni system contract at 0x8888… in local unit tests:
/// it records subscriptions and callback requests and does nothing else. Never deploy it. Public claims are proven
/// only by on-chain loops on Lasna.
contract SystemStub {
    struct Subscription {
        uint256 chainId;
        address contractAddress;
        uint256 topic0;
        uint256 topic1;
        uint256 topic2;
        uint256 topic3;
    }

    Subscription[] public subscriptions;
    ISystemContract.CallbackConfiguration_V_1_0[] internal requests;

    function subscribe(uint256 chainId, address contract_, uint256 t0, uint256 t1, uint256 t2, uint256 t3) external {
        subscriptions.push(Subscription(chainId, contract_, t0, t1, t2, t3));
    }

    Subscription[] public unsubscriptions;

    function unsubscribe(uint256 chainId, address contract_, uint256 t0, uint256 t1, uint256 t2, uint256 t3) external {
        unsubscriptions.push(Subscription(chainId, contract_, t0, t1, t2, t3));
    }

    function unsubscriptionCount() external view returns (uint256) {
        return unsubscriptions.length;
    }

    function requestCallbackV_1_0(ISystemContract.CallbackConfiguration_V_1_0 memory config) external {
        requests.push(config);
    }

    function subscriptionCount() external view returns (uint256) {
        return subscriptions.length;
    }

    function requestCount() external view returns (uint256) {
        return requests.length;
    }

    function request(uint256 i) external view returns (ISystemContract.CallbackConfiguration_V_1_0 memory) {
        return requests[i];
    }

    function debt(address) external pure returns (uint256) {
        return 0;
    }

    receive() external payable {}
}
