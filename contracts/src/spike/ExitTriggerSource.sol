// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title ExitTriggerSource (spike S2, Unichain Sepolia)
/// @notice A manual stand-in for Ripcord's real trigger, a v4 Swap crossing the user's line. S2 only has to prove that
/// a Reactive callback can run the exit on-chain. Spike-only: anyone can request an exit, but ExitProbe can only exit
/// positions it's approved for, and it pays the tokens to its fixed recipient.
contract ExitTriggerSource {
    event ExitRequested(uint256 indexed tokenId, address indexed requester);

    function requestExit(uint256 tokenId) external {
        emit ExitRequested(tokenId, msg.sender);
    }
}
