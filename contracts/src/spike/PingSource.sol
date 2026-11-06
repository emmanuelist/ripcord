// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title PingSource (spike S1, pool chain)
/// @notice Origin of the S1 latency loop. Each `ping()` emits one event for the Lasna reactive contract to pick up.
contract PingSource {
    /// @param seq Monotonic ping number, also the key that links all three hops of one loop.
    /// @param sender Who sent the ping.
    /// @param sentAt Origin block timestamp (seconds). Base Sepolia shares one timestamp across ~5 blocks.
    event Ping(uint256 indexed seq, address indexed sender, uint256 sentAt);

    uint256 public seq;

    function ping() external returns (uint256 seq_) {
        seq_ = ++seq;
        emit Ping(seq_, msg.sender, block.timestamp);
    }
}
