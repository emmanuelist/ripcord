import { parseAbi, parseAbiItem } from "viem";

// Signatures verified against the pinned sources and deployed bytecode (docs/CONTEXT.md).

export const positionManagerAbi = parseAbi([
  "function modifyLiquidities(bytes unlockData, uint256 deadline) payable",
  "function approve(address spender, uint256 id)",
  "function ownerOf(uint256 id) view returns (address)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
]);

export const vaultAbi = parseAbi([
  "function arm(uint256 tokenId, int24 triggerTick, bool exitBelow)",
  "function disarm(uint256 tokenId)",
  "function exit(address injectedSender, uint256 tokenId, int24 observedTick, uint256 originBlock, uint256 originTxHash)",
  "function lines(uint256 tokenId) view returns (address owner, bytes32 poolId, int24 triggerTick, bool exitBelow, uint8 status)",
]);

/** Errors a refusal can carry: reactive-lib-omni AbstractPayer/AbstractCallback, v4-periphery PositionManager. */
export const refusalErrorsAbi = parseAbi([
  "error NotAuthorized(address sender_, address provider_)",
  "error CallbackNotAuthorized(address sender_, address expectedSender_)",
  "error NotApproved(address caller)",
]);

export const swapRouterAbi = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "struct SwapParams { bool zeroForOne; int256 amountSpecified; uint160 sqrtPriceLimitX96; }",
  "struct TestSettings { bool takeClaims; bool settleUsingBurn; }",
  "function swap(PoolKey key, SwapParams params, TestSettings testSettings, bytes hookData) payable returns (int256)",
]);

export const stateViewAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
]);

export const erc721Transfer = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed id)",
);
/** v4-core IPoolManager.Swap (CONTEXT.md): the post-swap tick is in the event, so no read can be stale. */
export const poolSwap = parseAbiItem(
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
);
export const lineDisarmed = parseAbiItem("event LineDisarmed(bytes32 indexed poolId, uint256 indexed tokenId, address indexed owner)");
export const lineTracked = parseAbiItem(
  "event LineTracked(bytes32 indexed poolId, uint256 indexed tokenId, int24 triggerTick, bool exitBelow)",
);
export const ripcordPulled = parseAbiItem(
  "event RipcordPulled(bytes32 indexed poolId, uint256 indexed tokenId, int24 observedTick, uint256 originBlock, uint256 originTxHash)",
);
export const exited = parseAbiItem(
  "event Exited(bytes32 indexed poolId, uint256 indexed tokenId, address indexed recipient, int24 triggerTick, int24 observedTick, int24 tickAtExit, uint128 liquidity, uint256 amount0, uint256 amount1, uint256 originBlock, uint256 originTxHash)",
);
export const exitFailed = parseAbiItem(
  "event ExitFailed(bytes32 indexed poolId, uint256 indexed tokenId, address indexed owner, bytes reason)",
);

/** v4 PoolSwapTest price limits: TickMath.MIN_SQRT_PRICE + 1 and MAX_SQRT_PRICE - 1. */
export const MIN_SQRT_PRICE_LIMIT = 4295128740n;
export const MAX_SQRT_PRICE_LIMIT = 1461446703485210103287273052203988822378723970341n;

/** v4-periphery Actions codes (docs/CONTEXT.md). */
export const Actions = { MINT_POSITION: 0x02, SETTLE_PAIR: 0x0d } as const;
