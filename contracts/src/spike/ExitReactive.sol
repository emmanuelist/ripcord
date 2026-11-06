// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractReactive} from "reactive-lib-omni/base/AbstractReactive.sol";
import {ISystemContract} from "reactive-lib-omni/interfaces/ISystemContract.sol";
import {ExitProbe} from "./ExitProbe.sol";

/// @title ExitReactive (spike S2, Reactive Lasna)
/// @notice Answers each `ExitRequested(tokenId)` on the pool chain with a callback to `ExitProbe.exit`.
contract ExitReactive is AbstractReactive {
    uint256 public constant EXIT_REQUESTED_TOPIC = uint256(keccak256("ExitRequested(uint256,address)"));
    /// @dev The relayer's whole tx gas limit. The proxy keeps ~176.5k, which leaves ~823.5k for an exit measured at
    /// ~196.5k (E-004, docs/CONTEXT.md). Fees are charged on gas used.
    uint64 public constant CALLBACK_GAS = 1_000_000;

    uint256 public immutable POOL_CHAIN_ID;
    address public immutable TRIGGER_SOURCE;
    address public immutable EXIT_PROBE;

    event ExitRequestSeen(uint256 indexed tokenId, uint256 originBlock, uint256 originTxHash);

    error UnexpectedLog(uint256 chainId, address emitter, uint256 topic0);
    error ZeroAddress();

    constructor(uint256 poolChainId_, address triggerSource_, address exitProbe_) payable {
        if (triggerSource_ == address(0) || exitProbe_ == address(0)) revert ZeroAddress();
        POOL_CHAIN_ID = poolChainId_;
        TRIGGER_SOURCE = triggerSource_;
        EXIT_PROBE = exitProbe_;
        SYSTEM.subscribe(
            poolChainId_, triggerSource_, EXIT_REQUESTED_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
        );
    }

    function react(LogRecord calldata log_) external onlySystem {
        if (
            log_.chainId != POOL_CHAIN_ID || log_.contractAddress != TRIGGER_SOURCE
                || log_.topic0 != EXIT_REQUESTED_TOPIC
        ) {
            revert UnexpectedLog(log_.chainId, log_.contractAddress, log_.topic0);
        }
        uint256 tokenId = log_.topic1;
        emit ExitRequestSeen(tokenId, log_.blockNumber, log_.txHash);

        bytes memory payload = abi.encodeCall(ExitProbe.exit, (address(0), tokenId));
        SYSTEM.requestCallbackV_1_0(
            ISystemContract.CallbackConfiguration_V_1_0({
                chainId: POOL_CHAIN_ID, recipient: EXIT_PROBE, gasLimit: CALLBACK_GAS, payload: payload
            })
        );
    }

    /// @notice Pays any outstanding debt to the system contract from this contract's lREACT balance.
    function coverDebt() external {
        _coverDebt();
    }
}
