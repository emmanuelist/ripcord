// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ERC20} from "solmate/src/tokens/ERC20.sol";

/// @title TestToken (spike S2, Unichain Sepolia)
/// @notice A disclosed test token. Testnet v4 pools have no organic liquidity, so Ripcord's demos use a token pair we
/// mint ourselves. Only the deployer can mint.
contract TestToken is ERC20 {
    address public immutable MINTER;

    error NotMinter();

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_, 18) {
        MINTER = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != MINTER) revert NotMinter();
        _mint(to, amount);
    }
}
