import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { deploy, uni } from "./clients";
import { positionManagerAbi } from "./abi";
import type { Position } from "./model";

export interface Custody {
  tokenId: bigint;
  /** The block just before the exit landed. */
  beforeBlock: bigint;
  before: Hex;
  now: Hex;
}

/** Who held the position NFT the block before its exit, and who holds it now: two reads, once per quoted exit. */
export function useCustody(p: Position | undefined): Custody | undefined {
  const [custody, setCustody] = useState<Custody | undefined>(undefined);
  const exitBlock = p?.exit?.block;
  const tokenId = p?.tokenId;

  useEffect(() => {
    if (exitBlock === undefined || tokenId === undefined) return;
    let stopped = false;
    const beforeBlock = exitBlock - 1n;
    const read = (blockNumber?: bigint) =>
      uni.readContract({ address: deploy.positionManager, abi: positionManagerAbi, functionName: "ownerOf", args: [tokenId], blockNumber });
    Promise.all([read(beforeBlock), read()])
      .then(([before, now]) => !stopped && setCustody({ tokenId, beforeBlock, before, now }))
      .catch(() => undefined); // the sentence stays unproven rather than guessed
    return () => {
      stopped = true;
    };
  }, [exitBlock, tokenId]);

  return custody && custody.tokenId === tokenId ? custody : undefined;
}
