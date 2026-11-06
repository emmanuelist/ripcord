// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractCallback} from "reactive-lib-omni/base/AbstractCallback.sol";
import {IPayable} from "reactive-lib-omni/interfaces/IPayable.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {PositionInfo, PositionInfoLibrary} from "@uniswap/v4-periphery/src/libraries/PositionInfoLibrary.sol";

/// @dev ERC721 reads on the PositionManager (solmate getters; selectors verified in deployed bytecode).
interface IERC721Approvals {
    function ownerOf(uint256 id) external view returns (address);
    function getApproved(uint256 id) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

/// @title RipcordVault
/// @notice Your Uniswap v4 position leaves the pool within N seconds of crossing your line, with nothing of yours
/// running.
/// @dev The owner keeps the position NFT and approves this vault (D-010). `arm` records a line. RipcordReactive on
/// Reactive Lasna watches the pool's Swap events and, once the line is crossed, calls `exit` through the Reactive
/// callback proxy. `exit` removes all liquidity and pays both tokens to the NFT's current owner. A failed exit (approval
/// revoked, NFT moved, subscriber added) is caught and emitted as `ExitFailed` instead of vanishing in the proxy.
contract RipcordVault is AbstractCallback {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using PositionInfoLibrary for PositionInfo;
    using CurrencyLibrary for Currency;

    enum Status {
        None,
        Armed,
        Exited,
        Failed,
        Disarmed
    }

    struct Line {
        address owner;
        PoolId poolId;
        int24 triggerTick;
        bool exitBelow;
        Status status;
    }

    struct ExitResult {
        address recipient;
        uint128 liquidity;
        uint256 amount0;
        uint256 amount1;
    }

    /// @dev Matches RipcordReactive's per-pool bound. A swap crossing every line fires them all in one react(), at ~60k
    /// each (84,360 gas measured for one request, E-005), which must stay under Lasna's 900k cap (D-012).
    uint256 public constant MAX_LINES_PER_POOL = 8;

    IPoolManager public immutable POOL_MANAGER;
    IPositionManager public immutable POSITION_MANAGER;

    mapping(uint256 tokenId => Line) public lines;
    mapping(PoolId poolId => uint256) public armedInPool;

    event LineArmed(
        PoolId indexed poolId, uint256 indexed tokenId, address indexed owner, int24 triggerTick, bool exitBelow
    );
    event LineDisarmed(PoolId indexed poolId, uint256 indexed tokenId, address indexed owner);
    event Exited(
        PoolId indexed poolId,
        uint256 indexed tokenId,
        address indexed recipient,
        int24 triggerTick,
        int24 observedTick,
        int24 tickAtExit,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1,
        uint256 originBlock,
        uint256 originTxHash
    );
    event ExitFailed(PoolId indexed poolId, uint256 indexed tokenId, address indexed owner, bytes reason);

    error ZeroAddress();
    error NotOwner(uint256 tokenId, address caller);
    error VaultNotApproved(uint256 tokenId);
    error HasSubscriber(uint256 tokenId);
    error NoLiquidity(uint256 tokenId);
    error TickOutOfRange(int24 tick);
    error LineAlreadyCrossed(int24 currentTick, int24 triggerTick, bool exitBelow);
    error PoolFull(PoolId poolId);
    error NotArmed(uint256 tokenId, Status status);
    error LineNotCrossed(uint256 tokenId, int24 observedTick, int24 triggerTick, bool exitBelow);
    error OnlySelf();

    /// @param callbackProxy_ Reactive callback proxy on this chain (docs/CONTEXT.md).
    /// @param ripcordReactive_ RipcordReactive's address on Lasna, the only sender whose callbacks this vault obeys.
    constructor(
        address callbackProxy_,
        address ripcordReactive_,
        IPoolManager poolManager_,
        IPositionManager positionManager_
    ) payable AbstractCallback(IPayable(payable(callbackProxy_)), ripcordReactive_) {
        if (
            callbackProxy_ == address(0) || ripcordReactive_ == address(0) || address(poolManager_) == address(0)
                || address(positionManager_) == address(0)
        ) revert ZeroAddress();
        POOL_MANAGER = poolManager_;
        POSITION_MANAGER = positionManager_;
    }

    /// @notice Arms (or re-aims) the ripcord on your position: exit once the pool's tick reaches `triggerTick`.
    /// @param exitBelow True to exit when the tick falls to or below the line (stop-loss); false for at or above.
    function arm(uint256 tokenId, int24 triggerTick, bool exitBelow) external {
        IERC721Approvals nft = IERC721Approvals(address(POSITION_MANAGER));
        address owner = nft.ownerOf(tokenId);
        if (msg.sender != owner) revert NotOwner(tokenId, msg.sender);
        if (nft.getApproved(tokenId) != address(this) && !nft.isApprovedForAll(owner, address(this))) {
            revert VaultNotApproved(tokenId);
        }
        if (triggerTick < TickMath.MIN_TICK || triggerTick > TickMath.MAX_TICK) revert TickOutOfRange(triggerTick);

        (PoolKey memory key, PositionInfo info) = POSITION_MANAGER.getPoolAndPositionInfo(tokenId);
        if (info.hasSubscriber()) revert HasSubscriber(tokenId);
        if (POSITION_MANAGER.getPositionLiquidity(tokenId) == 0) revert NoLiquidity(tokenId);

        PoolId poolId = key.toId();
        (, int24 currentTick,,) = POOL_MANAGER.getSlot0(poolId);
        if (_crosses(currentTick, triggerTick, exitBelow)) {
            revert LineAlreadyCrossed(currentTick, triggerTick, exitBelow);
        }

        Line storage line = lines[tokenId];
        if (line.status != Status.Armed) {
            if (armedInPool[poolId] >= MAX_LINES_PER_POOL) revert PoolFull(poolId);
            ++armedInPool[poolId];
        }
        lines[tokenId] = Line(owner, poolId, triggerTick, exitBelow, Status.Armed);
        emit LineArmed(poolId, tokenId, owner, triggerTick, exitBelow);
    }

    /// @notice Disarms your line. Only the owner who armed it can.
    function disarm(uint256 tokenId) external {
        Line storage line = lines[tokenId];
        if (line.status != Status.Armed) revert NotArmed(tokenId, line.status);
        if (msg.sender != line.owner) revert NotOwner(tokenId, msg.sender);
        line.status = Status.Disarmed;
        --armedInPool[line.poolId];
        emit LineDisarmed(line.poolId, tokenId, line.owner);
    }

    /// @notice Pulls the ripcord. Callable only through the Reactive callback proxy by RipcordReactive.
    /// @param injectedSender Overwritten by Reactive with the requesting reactive contract's address (verified, E-005).
    /// @param observedTick The post-swap tick RipcordReactive saw in the triggering Swap event.
    function exit(
        address injectedSender,
        uint256 tokenId,
        int24 observedTick,
        uint256 originBlock,
        uint256 originTxHash
    ) external onlyServiceProvider onlyCallbackSender(injectedSender) {
        Line storage line = lines[tokenId];
        if (line.status != Status.Armed) revert NotArmed(tokenId, line.status);
        if (!_crosses(observedTick, line.triggerTick, line.exitBelow)) {
            revert LineNotCrossed(tokenId, observedTick, line.triggerTick, line.exitBelow);
        }
        // Effects before the external call: a pool token could re-enter during the exit's transfers. With the status
        // already final, a re-entrant disarm() hits NotArmed instead of decrementing the pool counter twice.
        line.status = Status.Exited;
        --armedInPool[line.poolId];
        (, int24 tickAtExit,,) = POOL_MANAGER.getSlot0(line.poolId);

        // The two events below report the outcome of the external call, so they can only be emitted after it.
        try this.performExit(tokenId) returns (ExitResult memory r) {
            // forge-lint: disable-start(reentrancy-events)
            emit Exited(
                line.poolId,
                tokenId,
                r.recipient,
                line.triggerTick,
                observedTick,
                tickAtExit,
                r.liquidity,
                r.amount0,
                r.amount1,
                originBlock,
                originTxHash
            );
            // forge-lint: disable-end(reentrancy-events)
        } catch (bytes memory reason) {
            line.status = Status.Failed;
            // forge-lint: disable-next-line(reentrancy-events)
            emit ExitFailed(line.poolId, tokenId, line.owner, reason);
        }
    }

    /// @notice The exit itself, isolated so any failure can be caught and reported. Only this contract may call it.
    function performExit(uint256 tokenId) external returns (ExitResult memory r) {
        if (msg.sender != address(this)) revert OnlySelf();
        (PoolKey memory key, PositionInfo info) = POSITION_MANAGER.getPoolAndPositionInfo(tokenId);
        if (info.hasSubscriber()) revert HasSubscriber(tokenId);
        r.recipient = IERC721Approvals(address(POSITION_MANAGER)).ownerOf(tokenId);
        r.liquidity = POSITION_MANAGER.getPositionLiquidity(tokenId);
        if (r.liquidity == 0) revert NoLiquidity(tokenId);

        uint256 before0 = key.currency0.balanceOf(r.recipient);
        uint256 before1 = key.currency1.balanceOf(r.recipient);

        // Action codes are the constants 0x01 and 0x11 (docs/CONTEXT.md), so the uint8 casts can't truncate.
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes memory actions = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        // Liquidity removal only, so mins are 0 by design (D-011): removal isn't sandwich-profitable.
        params[0] = abi.encode(tokenId, uint256(r.liquidity), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1, r.recipient);
        POSITION_MANAGER.modifyLiquidities(abi.encode(actions, params), block.timestamp);

        r.amount0 = key.currency0.balanceOf(r.recipient) - before0;
        r.amount1 = key.currency1.balanceOf(r.recipient) - before1;
    }

    /// @notice Pays any outstanding callback debt to the proxy from this contract's balance.
    function coverDebt() external {
        _coverDebt();
    }

    function _crosses(int24 tick, int24 triggerTick, bool exitBelow) internal pure returns (bool) {
        return exitBelow ? tick <= triggerTick : tick >= triggerTick;
    }
}
