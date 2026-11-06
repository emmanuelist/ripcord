// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {AbstractReactive} from "reactive-lib-omni/base/AbstractReactive.sol";
import {ISystemContract} from "reactive-lib-omni/interfaces/ISystemContract.sol";
import {RipcordVault} from "./RipcordVault.sol";

/// @title RipcordReactive (Reactive Lasna)
/// @notice Watches every pool that has an armed line and pulls the ripcord the moment a Swap crosses it.
/// @dev It learns lines from RipcordVault's LineArmed / LineDisarmed events, so it never trusts anything but the vault.
/// It subscribes to a pool's v4 `Swap` (topic1 = poolId) when the pool's first line is armed, and unsubscribes when
/// the last one leaves. Each line fires at most once (D-011).
contract RipcordReactive is AbstractReactive {
    /// @dev v4 `Swap(PoolId indexed,address indexed,int128,int128,uint160,uint128,int24,uint24)` (CONTEXT.md, E-001).
    uint256 public constant SWAP_TOPIC = 0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f;
    uint256 public constant LINE_ARMED_TOPIC = uint256(RipcordVault.LineArmed.selector);
    uint256 public constant LINE_DISARMED_TOPIC = uint256(RipcordVault.LineDisarmed.selector);
    /// @dev Must match RipcordVault.MAX_LINES_PER_POOL.
    uint256 public constant MAX_LINES_PER_POOL = 8;
    /// @dev The relayer's whole tx limit. The proxy keeps ~176.5k, leaving ~823.5k for an exit that costs ~140k on-chain
    /// (E-006). Fees are charged on gas used.
    uint64 public constant CALLBACK_GAS = 1_000_000;

    struct Line {
        bytes32 poolId;
        int24 triggerTick;
        bool exitBelow;
        bool active;
    }

    uint256 public immutable POOL_CHAIN_ID;
    address public immutable POOL_MANAGER;
    address public immutable VAULT;

    mapping(uint256 tokenId => Line) public lines;
    mapping(bytes32 poolId => uint256[] tokenIds) internal _poolLines;

    event LineTracked(bytes32 indexed poolId, uint256 indexed tokenId, int24 triggerTick, bool exitBelow);
    event LineDropped(bytes32 indexed poolId, uint256 indexed tokenId);
    event PoolWatched(bytes32 indexed poolId);
    event PoolUnwatched(bytes32 indexed poolId);
    /// @notice Emitted in the reactive tx that requests an exit, so each loop's Lasna hop can be found by tokenId.
    event RipcordPulled(
        bytes32 indexed poolId, uint256 indexed tokenId, int24 observedTick, uint256 originBlock, uint256 originTxHash
    );
    /// @notice A line the vault armed that this contract couldn't track (a full pool). The vault also refuses this.
    event LineRejected(bytes32 indexed poolId, uint256 indexed tokenId);

    error ZeroAddress();
    error UnexpectedLog(uint256 chainId, address emitter, uint256 topic0);

    constructor(uint256 poolChainId_, address poolManager_, address vault_) payable {
        if (poolManager_ == address(0) || vault_ == address(0)) revert ZeroAddress();
        POOL_CHAIN_ID = poolChainId_;
        POOL_MANAGER = poolManager_;
        VAULT = vault_;
        SYSTEM.subscribe(poolChainId_, vault_, LINE_ARMED_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
        SYSTEM.subscribe(poolChainId_, vault_, LINE_DISARMED_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
    }

    function react(LogRecord calldata log_) external onlySystem {
        if (log_.chainId != POOL_CHAIN_ID) revert UnexpectedLog(log_.chainId, log_.contractAddress, log_.topic0);
        if (log_.contractAddress == VAULT && log_.topic0 == LINE_ARMED_TOPIC) {
            (int24 triggerTick, bool exitBelow) = abi.decode(log_.data, (int24, bool));
            _track(bytes32(log_.topic1), log_.topic2, triggerTick, exitBelow);
        } else if (log_.contractAddress == VAULT && log_.topic0 == LINE_DISARMED_TOPIC) {
            _drop(bytes32(log_.topic1), log_.topic2);
        } else if (log_.contractAddress == POOL_MANAGER && log_.topic0 == SWAP_TOPIC) {
            (,,,, int24 tick,) = abi.decode(log_.data, (int128, int128, uint160, uint128, int24, uint24));
            _onSwap(bytes32(log_.topic1), tick, log_.blockNumber, log_.txHash);
        } else {
            revert UnexpectedLog(log_.chainId, log_.contractAddress, log_.topic0);
        }
    }

    /// @notice Active tokenIds being watched in a pool.
    function poolLines(bytes32 poolId) external view returns (uint256[] memory) {
        return _poolLines[poolId];
    }

    /// @notice Pays any outstanding debt to the system contract from this contract's lREACT balance.
    function coverDebt() external {
        _coverDebt();
    }

    // Ordering throughout: state changes, then events, then calls to the system contract, which come last
    // (checks-effects-interactions, even though SYSTEM is trusted).

    function _track(bytes32 poolId, uint256 tokenId, int24 triggerTick, bool exitBelow) internal {
        Line storage line = lines[tokenId];
        if (line.active) {
            // A tokenId's pool never changes, so an active line is re-aimed in place.
            line.triggerTick = triggerTick;
            line.exitBelow = exitBelow;
            emit LineTracked(poolId, tokenId, triggerTick, exitBelow);
            return;
        }
        uint256[] storage ids = _poolLines[poolId];
        if (ids.length >= MAX_LINES_PER_POOL) {
            emit LineRejected(poolId, tokenId);
            return;
        }
        bool firstInPool = ids.length == 0;
        ids.push(tokenId);
        lines[tokenId] = Line(poolId, triggerTick, exitBelow, true);
        emit LineTracked(poolId, tokenId, triggerTick, exitBelow);
        if (firstInPool) {
            emit PoolWatched(poolId);
            SYSTEM.subscribe(POOL_CHAIN_ID, POOL_MANAGER, SWAP_TOPIC, uint256(poolId), REACTIVE_IGNORE, REACTIVE_IGNORE);
        }
    }

    function _drop(bytes32 poolId, uint256 tokenId) internal {
        Line storage line = lines[tokenId];
        if (!line.active || line.poolId != poolId) return;
        line.active = false;
        uint256[] storage ids = _poolLines[poolId];
        for (uint256 i = 0; i < ids.length; ++i) {
            if (ids[i] == tokenId) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                break;
            }
        }
        emit LineDropped(poolId, tokenId);
        _unwatchIfEmpty(poolId);
    }

    function _onSwap(bytes32 poolId, int24 tick, uint256 originBlock, uint256 originTxHash) internal {
        uint256[] storage ids = _poolLines[poolId];
        uint256[] memory fired = new uint256[](ids.length);
        uint256 n = 0;
        // Pass 1, state + events: walk backwards so swap-and-pop removal doesn't skip entries.
        for (uint256 i = ids.length; i > 0; --i) {
            uint256 tokenId = ids[i - 1];
            Line storage line = lines[tokenId];
            if (line.exitBelow ? tick <= line.triggerTick : tick >= line.triggerTick) {
                line.active = false;
                ids[i - 1] = ids[ids.length - 1];
                ids.pop();
                fired[n++] = tokenId;
                emit RipcordPulled(poolId, tokenId, tick, originBlock, originTxHash);
            }
        }
        bool emptied = n > 0 && ids.length == 0;
        if (emptied) emit PoolUnwatched(poolId);
        // Pass 2, interactions: one exit callback per crossed line (at most MAX_LINES_PER_POOL), then unsubscribe.
        for (uint256 i = 0; i < n; ++i) {
            _requestExit(fired[i], tick, originBlock, originTxHash);
        }
        if (emptied) _unsubscribePool(poolId);
    }

    function _requestExit(uint256 tokenId, int24 tick, uint256 originBlock, uint256 originTxHash) internal {
        // First argument is a placeholder: Reactive overwrites it with this contract's address (E-005).
        bytes memory payload = abi.encodeCall(RipcordVault.exit, (address(0), tokenId, tick, originBlock, originTxHash));
        // Called once per crossed line from a loop bounded by MAX_LINES_PER_POOL, by design: each line is its own exit.
        // forge-lint: disable-start(calls-loop)
        SYSTEM.requestCallbackV_1_0(
            ISystemContract.CallbackConfiguration_V_1_0({
                chainId: POOL_CHAIN_ID, recipient: VAULT, gasLimit: CALLBACK_GAS, payload: payload
            })
        );
        // forge-lint: disable-end(calls-loop)
    }

    function _unwatchIfEmpty(bytes32 poolId) internal {
        if (_poolLines[poolId].length != 0) return;
        emit PoolUnwatched(poolId);
        _unsubscribePool(poolId);
    }

    function _unsubscribePool(bytes32 poolId) internal {
        SYSTEM.unsubscribe(POOL_CHAIN_ID, POOL_MANAGER, SWAP_TOPIC, uint256(poolId), REACTIVE_IGNORE, REACTIVE_IGNORE);
    }
}
