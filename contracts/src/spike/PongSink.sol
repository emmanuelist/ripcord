// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractCallback} from "reactive-lib-omni/base/AbstractCallback.sol";
import {IPayable} from "reactive-lib-omni/interfaces/IPayable.sol";

interface IPongSink {
    function pong(address injectedSender, uint256 seq, uint256 originBlock, uint256 originTxHash) external;
}

/// @title PongSink (spike S1, pool chain)
/// @notice Destination of the S1 latency loop. It accepts calls only from the Reactive callback proxy.
/// @dev Spike-only behaviour: it RECORDS whether the sender Reactive injected into the first argument equals the
/// expected reactive contract, instead of reverting. S1 exists to learn what Omni actually injects (the docs say the
/// requesting reactive contract's address). Ripcord's vault enforces `onlyCallbackSender`; this contract doesn't.
contract PongSink is AbstractCallback, IPongSink {
    event Pong(
        uint256 indexed seq,
        address indexed injectedSender,
        bool senderIsExpected,
        uint256 originBlock,
        uint256 originTxHash,
        uint256 receivedAt
    );

    uint256 public pongs;

    /// @param callbackProxy_ Reactive callback proxy on this chain (docs/CONTEXT.md).
    /// @param expectedReactive_ The PingReactive address on Lasna, precomputed from the deployer's Lasna nonce.
    constructor(address callbackProxy_, address expectedReactive_)
        payable
        AbstractCallback(IPayable(payable(callbackProxy_)), expectedReactive_)
    {}

    function pong(address injectedSender, uint256 seq, uint256 originBlock, uint256 originTxHash)
        external
        onlyServiceProvider
    {
        unchecked {
            ++pongs;
        }
        emit Pong(seq, injectedSender, injectedSender == _CALLBACK_SENDER, originBlock, originTxHash, block.timestamp);
    }

    /// @notice Pays any outstanding callback debt to the proxy from this contract's balance.
    function coverDebt() external {
        _coverDebt();
    }
}
