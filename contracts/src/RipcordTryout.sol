// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {RipcordVault} from "./RipcordVault.sol";

interface IERC20Approve {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IERC721Approve {
    function approve(address spender, uint256 id) external;
}

/// @title RipcordTryout
/// @notice Lets anyone run a real Ripcord loop on the demo pool with two transactions and nothing but testnet gas.
/// `arm()` mints a position from this contract's own stock of test tokens, approves RipcordVault and arms a line one
/// tick spacing from the price. A few seconds later, once RipcordReactive on Lasna is tracking it, `cross(tokenId)`
/// swaps to just past that line. Reactive pulls the ripcord and the vault exits: the tokens come back here, so the stock
/// recycles. The positions are this contract's: nothing here touches anyone else's funds or Ripcord's own contracts.
contract RipcordTryout {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    /// Between two arms, so one caller can't burn RipcordReactive's lREACT faster than a demo needs (timestamps, not blocks).
    uint256 public constant COOLDOWN = 60;
    /// One tick spacing of the demo pool.
    int24 public constant GAP = 60;
    /// The crossing swap stops this many ticks past the line, so it crosses whatever liquidity the pool holds.
    int24 public constant CROSS_BY = 2;
    uint256 public constant LIQUIDITY = 1_000e18;
    /// A cap on the swap's input, not its size: the price limit decides how much is spent.
    uint256 public constant SWAP_CAP = 100_000e18;

    RipcordVault public immutable VAULT;
    IPoolManager public immutable POOL_MANAGER;
    IPositionManager public immutable POSM;
    PoolSwapTest public immutable SWAP_ROUTER;
    address public immutable OWNER;
    Currency internal immutable CURRENCY0;
    Currency internal immutable CURRENCY1;

    struct Tryout {
        address by;
        int24 line;
        bool exitBelow;
        bool crossed;
    }

    mapping(uint256 tokenId => Tryout) public tryouts;
    uint256 public lastArmAt;
    bool public lastBelow;
    bool public open = true;

    event TryoutArmed(address indexed by, uint256 indexed tokenId, int24 line, bool exitBelow);
    event TryoutCrossed(address indexed by, uint256 indexed tokenId, int24 tickAfter, int128 amount0, int128 amount1);

    error Closed();
    error CoolingDown(uint256 readyAt);
    error NotATryout(uint256 tokenId);
    error AlreadyCrossed(uint256 tokenId);
    error NotOwner();
    error ApproveFailed();

    constructor(
        RipcordVault vault_,
        IPoolManager poolManager_,
        IPositionManager posm_,
        IAllowanceTransfer permit2_,
        PoolSwapTest swapRouter_,
        Currency currency0_,
        Currency currency1_
    ) {
        VAULT = vault_;
        POOL_MANAGER = poolManager_;
        POSM = posm_;
        SWAP_ROUTER = swapRouter_;
        OWNER = msg.sender;
        CURRENCY0 = currency0_;
        CURRENCY1 = currency1_;
        // Mints pull through Permit2; swaps through the router. Both tokens are the demo pool's test tokens.
        _approve(Currency.unwrap(currency0_), permit2_, posm_, swapRouter_);
        _approve(Currency.unwrap(currency1_), permit2_, posm_, swapRouter_);
    }

    function _approve(address token, IAllowanceTransfer permit2_, IPositionManager posm_, PoolSwapTest router_)
        private
    {
        if (!IERC20Approve(token).approve(address(permit2_), type(uint256).max)) revert ApproveFailed();
        if (!IERC20Approve(token).approve(address(router_), type(uint256).max)) revert ApproveFailed();
        permit2_.approve(token, address(posm_), type(uint160).max, type(uint48).max);
    }

    /// The demo pool: fee 3000, tick spacing 60, no hooks (docs/evidence/m1/deploy.json).
    function key() public view returns (PoolKey memory) {
        return
            PoolKey({currency0: CURRENCY0, currency1: CURRENCY1, fee: 3000, tickSpacing: 60, hooks: IHooks(address(0))});
    }

    /// @notice Mints a position from this contract's stock, approves RipcordVault and arms a line one tick spacing away.
    /// Directions alternate so the demo pool's price oscillates instead of drifting.
    function arm() external returns (uint256 tokenId, int24 line, bool exitBelow) {
        if (!open) revert Closed();
        // A demo rate limit in seconds (AGENTS.md rule 4: timestamps, never block counts); a validator's few seconds
        // of skew don't matter here.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < lastArmAt + COOLDOWN) revert CoolingDown(lastArmAt + COOLDOWN);
        lastArmAt = block.timestamp;
        exitBelow = !lastBelow;
        lastBelow = exitBelow;

        PoolKey memory k = key();
        (, int24 tick,,) = POOL_MANAGER.getSlot0(k.toId());
        line = exitBelow ? tick - GAP : tick + GAP;

        tokenId = POSM.nextTokenId();
        // Action codes are the constants 0x02 and 0x0d (docs/CONTEXT.md), so the uint8 casts can't truncate.
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            k, int24(-6000), int24(6000), LIQUIDITY, type(uint128).max, type(uint128).max, address(this), ""
        );
        params[1] = abi.encode(k.currency0, k.currency1);
        POSM.modifyLiquidities(abi.encode(actions, params), block.timestamp);

        IERC721Approve(address(POSM)).approve(address(VAULT), tokenId);
        tryouts[tokenId] = Tryout({by: msg.sender, line: line, exitBelow: exitBelow, crossed: false});
        VAULT.arm(tokenId, line, exitBelow);
        // Reports the outcome of the calls above, to the trusted PositionManager and RipcordVault, so it follows them.
        // forge-lint: disable-next-line(reentrancy-events)
        emit TryoutArmed(msg.sender, tokenId, line, exitBelow);
    }

    /// @notice Swaps the demo pool to just past a tryout's line. Anyone may call it; give Lasna a few seconds after
    /// `arm()` to start tracking the line, or the swap lands before RipcordReactive is watching for it.
    function cross(uint256 tokenId) external returns (int24 tickAfter) {
        Tryout storage t = tryouts[tokenId];
        if (t.by == address(0)) revert NotATryout(tokenId);
        if (t.crossed) revert AlreadyCrossed(tokenId);
        t.crossed = true;

        PoolKey memory k = key();
        uint160 limit = TickMath.getSqrtPriceAtTick(t.exitBelow ? t.line - CROSS_BY : t.line + CROSS_BY);
        BalanceDelta delta = SWAP_ROUTER.swap(
            k,
            // SWAP_CAP is the constant 1e23, far inside int256, so the cast can't truncate.
            // forge-lint: disable-next-line(unsafe-typecast)
            SwapParams({zeroForOne: t.exitBelow, amountSpecified: -int256(SWAP_CAP), sqrtPriceLimitX96: limit}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        (, tickAfter,,) = POOL_MANAGER.getSlot0(k.toId());
        // Reports the swap's outcome, so it follows the call to the trusted router.
        // forge-lint: disable-next-line(reentrancy-events)
        emit TryoutCrossed(msg.sender, tokenId, tickAfter, delta.amount0(), delta.amount1());
    }

    /// @notice The owner can close the tryout (for example if RipcordReactive's lREACT runs low) and reopen it.
    function setOpen(bool open_) external {
        if (msg.sender != OWNER) revert NotOwner();
        open = open_;
    }
}
