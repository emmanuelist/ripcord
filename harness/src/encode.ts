import { getSqrtPriceAtTick } from "./tickmath.js";
import { encodeAbiParameters, encodeFunctionData, encodePacked, type Address, type Hex } from "viem";
import {
  Actions,
  MAX_SQRT_PRICE_LIMIT,
  MIN_SQRT_PRICE_LIMIT,
  positionManagerAbi,
  swapRouterAbi,
  vaultAbi,
} from "./abi.js";

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

const poolKeyComponents = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;

/** PositionManager.modifyLiquidities(MINT_POSITION + SETTLE_PAIR), the same encoding MintDemoPosition uses. */
export function encodeMint(
  key: PoolKey,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  owner: Address,
  deadline: bigint,
): Hex {
  const maxUint128 = (1n << 128n) - 1n;
  const actions = encodePacked(["uint8", "uint8"], [Actions.MINT_POSITION, Actions.SETTLE_PAIR]);
  const mintParams = encodeAbiParameters(
    [
      { type: "tuple", components: poolKeyComponents },
      { type: "int24" },
      { type: "int24" },
      { type: "uint256" },
      { type: "uint128" },
      { type: "uint128" },
      { type: "address" },
      { type: "bytes" },
    ],
    [key, tickLower, tickUpper, liquidity, maxUint128, maxUint128, owner, "0x"],
  );
  const settleParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }],
    [key.currency0, key.currency1],
  );
  const unlockData = encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [mintParams, settleParams]],
  );
  return encodeFunctionData({
    abi: positionManagerAbi,
    functionName: "modifyLiquidities",
    args: [unlockData, deadline],
  });
}

export function encodeApprove(spender: Address, tokenId: bigint): Hex {
  return encodeFunctionData({ abi: positionManagerAbi, functionName: "approve", args: [spender, tokenId] });
}

export function encodeArm(tokenId: bigint, triggerTick: number, exitBelow: boolean): Hex {
  return encodeFunctionData({ abi: vaultAbi, functionName: "arm", args: [tokenId, triggerTick, exitBelow] });
}

/**
 * An exact-input swap through v4 PoolSwapTest: zeroForOne pushes the tick down, otherwise up. With a price limit, the
 * swap stops there and spends only what it takes to reach it (amountIn is then a cap), whatever the pool's liquidity.
 */
export function encodeSwap(key: PoolKey, zeroForOne: boolean, amountIn: bigint, sqrtPriceLimitX96?: bigint): Hex {
  return encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "swap",
    args: [
      key,
      {
        zeroForOne,
        amountSpecified: -amountIn,
        sqrtPriceLimitX96: sqrtPriceLimitX96 ?? (zeroForOne ? MIN_SQRT_PRICE_LIMIT : MAX_SQRT_PRICE_LIMIT),
      },
      { takeClaims: false, settleUsingBurn: false },
      "0x",
    ],
  });
}

/** How far past the line the crossing swap is told to stop. */
export const CROSS_BY = 2;

/**
 * Run n alternates direction (odd: exit below, swap down; even: exit above, swap up) so the price oscillates. The swap's
 * price limit sits CROSS_BY ticks past the line, so it always crosses, however much liquidity the pool holds (the
 * refusal positions #7955 and #7956 left 2e21 in range, which stopped a fixed-size swap 58 ticks short on 2026-11-14).
 */
export function planRun(run: number, currentTick: number, gap: number) {
  const exitBelow = run % 2 === 1;
  const line = exitBelow ? currentTick - gap : currentTick + gap;
  return { exitBelow, zeroForOne: exitBelow, line, sqrtPriceLimitX96: getSqrtPriceAtTick(exitBelow ? line - CROSS_BY : line + CROSS_BY) };
}
