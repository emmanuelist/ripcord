// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractCallback} from "reactive-lib-omni/base/AbstractCallback.sol";
import {IPayable} from "reactive-lib-omni/interfaces/IPayable.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {PositionInfo, PositionInfoLibrary} from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

/// @title ExitProbe (spike S2, pool chain)
/// @notice Answers kill criterion (b): can a Reactive callback pull a v4 position's liquidity within its gas limit?
/// It owns v4 position NFTs and, when called through the callback proxy by the expected reactive contract, removes
/// all liquidity from one position and sends both tokens to `RECIPIENT`.
/// @dev Spike-only simplifications that Ripcord's vault must not keep:
/// - amount0Min/amount1Min are 0. The vault derives them from the triggering Swap's sqrtPriceX96.
/// - There's one recipient for every position.
/// - There's no per-position owner, line or idempotency record.
contract ExitProbe is AbstractCallback {
    using PositionInfoLibrary for PositionInfo;

    IPositionManager public immutable POSITION_MANAGER;
    address public immutable RECIPIENT;

    event Exited(uint256 indexed tokenId, uint128 liquidity, int24 tickLower, int24 tickUpper);

    error ZeroAddress();
    error NothingToExit(uint256 tokenId);
    /// @dev A subscribed position calls its subscriber on every liquidity change, which is arbitrary code that can
    /// revert or burn the callback's gas. Ripcord refuses such positions rather than risk a silent failed exit.
    error HasSubscriber(uint256 tokenId);

    constructor(
        address callbackProxy_,
        address expectedReactive_,
        IPositionManager positionManager_,
        address recipient_
    ) payable AbstractCallback(IPayable(payable(callbackProxy_)), expectedReactive_) {
        if (address(positionManager_) == address(0) || recipient_ == address(0)) {
            revert ZeroAddress();
        }
        POSITION_MANAGER = positionManager_;
        RECIPIENT = recipient_;
    }

    /// @param injectedSender Overwritten by Reactive with the requesting reactive contract's address.
    function exit(address injectedSender, uint256 tokenId)
        external
        onlyServiceProvider
        onlyCallbackSender(injectedSender)
    {
        uint128 liquidity = POSITION_MANAGER.getPositionLiquidity(tokenId);
        if (liquidity == 0) revert NothingToExit(tokenId);
        (PoolKey memory key, PositionInfo info) = POSITION_MANAGER.getPoolAndPositionInfo(tokenId);
        if (info.hasSubscriber()) revert HasSubscriber(tokenId);

        // Emitted before the external call. If the exit reverts, the event reverts with it.
        emit Exited(tokenId, liquidity, info.tickLower(), info.tickUpper());

        // Actions codes are the constants 0x01 and 0x11 (docs/CONTEXT.md), so the uint8 casts can't truncate.
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes memory actions = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(tokenId, uint256(liquidity), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1, RECIPIENT);
        POSITION_MANAGER.modifyLiquidities(abi.encode(actions, params), block.timestamp);
    }

    /// @notice Pays any outstanding callback debt to the proxy from this contract's balance.
    function coverDebt() external {
        _coverDebt();
    }
}
