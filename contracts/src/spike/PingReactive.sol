// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractReactive} from "reactive-lib-omni/base/AbstractReactive.sol";
import {ISystemContract} from "reactive-lib-omni/interfaces/ISystemContract.sol";
import {IPongSink} from "./PongSink.sol";

/// @title PingReactive (spike S1, Reactive Lasna)
/// @notice Subscribes to PingSource's `Ping` on the pool chain and answers each one with a callback to PongSink.
/// It measures the Omni loop: origin event -> reactive tx on Lasna -> callback on the destination.
contract PingReactive is AbstractReactive {
    /// @dev keccak256("Ping(uint256,address,uint256)")
    uint256 public constant PING_TOPIC = uint256(keccak256("Ping(uint256,address,uint256)"));
    /// @dev This is the relayer's WHOLE transaction gas limit, not the target's budget. The Omni callback proxy keeps
    /// ~176.5k for itself, so 200k left pong only 23.5k and it ran out of gas on testnet (S1 v2,
    /// docs/evidence/s1/unichain-v2-callback-oog-trace-2026-11-06.txt). Fees are charged on gas used, not this limit.
    uint64 public constant CALLBACK_GAS = 500_000;

    uint256 public immutable ORIGIN_CHAIN_ID;
    address public immutable PING_SOURCE;
    uint256 public immutable DEST_CHAIN_ID;
    address public immutable PONG_SINK;

    /// @notice Emitted in the reactive tx, so the harness can find the Lasna hop for a given `seq`.
    event PingSeen(uint256 indexed seq, uint256 originBlock, uint256 originTxHash);

    error UnexpectedLog(uint256 chainId, address emitter, uint256 topic0);
    error ZeroAddress();

    constructor(uint256 originChainId_, address pingSource_, uint256 destChainId_, address pongSink_) payable {
        if (pingSource_ == address(0) || pongSink_ == address(0)) revert ZeroAddress();
        ORIGIN_CHAIN_ID = originChainId_;
        PING_SOURCE = pingSource_;
        DEST_CHAIN_ID = destChainId_;
        PONG_SINK = pongSink_;
        SYSTEM.subscribe(originChainId_, pingSource_, PING_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
    }

    function react(LogRecord calldata log_) external onlySystem {
        if (log_.chainId != ORIGIN_CHAIN_ID || log_.contractAddress != PING_SOURCE || log_.topic0 != PING_TOPIC) {
            revert UnexpectedLog(log_.chainId, log_.contractAddress, log_.topic0);
        }
        uint256 seq = log_.topic1;
        emit PingSeen(seq, log_.blockNumber, log_.txHash);

        // First argument is a placeholder: Reactive overwrites its 160 bits with the requesting contract's address.
        bytes memory payload = abi.encodeCall(IPongSink.pong, (address(0), seq, log_.blockNumber, log_.txHash));
        SYSTEM.requestCallbackV_1_0(
            ISystemContract.CallbackConfiguration_V_1_0({
                chainId: DEST_CHAIN_ID, recipient: PONG_SINK, gasLimit: CALLBACK_GAS, payload: payload
            })
        );
    }

    /// @notice Pays any outstanding debt to the system contract from this contract's lREACT balance.
    function coverDebt() external {
        _coverDebt();
    }
}
