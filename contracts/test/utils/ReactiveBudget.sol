// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

// Gas the Omni callback proxy keeps for itself out of the callback config's `gasLimit`.
//
// The relayer's transaction gas limit equals the requested `gasLimit`. Inside, CallbackProxy._callback forwards only
// `gasleft() - (_extraGas + _maxChargeGas + failureEventGas)`. Observed on Unichain Sepolia
// (tx 0xb62e1f281ee685378f986bfb3cf462118692c5b2f882dc90ed19a2f540d385be): gasLimit 200,000 forwarded 23,512 gas to
// the target, so overhead = 176,488 for a 132-byte payload. Evidence: docs/evidence/s1/unichain-v2-callback-oog-trace.
// It grows slightly with payload size, so tests should treat it as a floor, not an exact value.
uint256 constant OBSERVED_PROXY_OVERHEAD_GAS = 176_488;
