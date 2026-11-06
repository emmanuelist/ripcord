import { parseAbi, parseAbiItem } from "viem";

// Mirrors contracts/src/RipcordVault.sol, RipcordReactive.sol and the v4 surfaces verified in docs/CONTEXT.md.

export const vaultAbi = parseAbi([
  "function lines(uint256 tokenId) view returns (address owner, bytes32 poolId, int24 triggerTick, bool exitBelow, uint8 status)",
  "function armedInPool(bytes32 poolId) view returns (uint256)",
  "error HasSubscriber(uint256 tokenId)",
  "error NoLiquidity(uint256 tokenId)",
  "error OnlySelf()",
]);

export const positionManagerAbi = parseAbi([
  "function ownerOf(uint256 id) view returns (address)",
  "function getApproved(uint256 id) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "error NotApproved(address caller)",
]);

export const stateViewAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
]);

export const lineArmed = parseAbiItem(
  "event LineArmed(bytes32 indexed poolId, uint256 indexed tokenId, address indexed owner, int24 triggerTick, bool exitBelow)",
);
export const lineDisarmed = parseAbiItem(
  "event LineDisarmed(bytes32 indexed poolId, uint256 indexed tokenId, address indexed owner)",
);
export const exited = parseAbiItem(
  "event Exited(bytes32 indexed poolId, uint256 indexed tokenId, address indexed recipient, int24 triggerTick, int24 observedTick, int24 tickAtExit, uint128 liquidity, uint256 amount0, uint256 amount1, uint256 originBlock, uint256 originTxHash)",
);
export const exitFailed = parseAbiItem(
  "event ExitFailed(bytes32 indexed poolId, uint256 indexed tokenId, address indexed owner, bytes reason)",
);
export const ripcordPulled = parseAbiItem(
  "event RipcordPulled(bytes32 indexed poolId, uint256 indexed tokenId, int24 observedTick, uint256 originBlock, uint256 originTxHash)",
);

export const vaultEvents = [lineArmed, lineDisarmed, exited, exitFailed] as const;

/** Errors an exit can fail with, for decoding ExitFailed.reason. Error(string) is declared explicitly: viem decodes it
 * natively, and solmate's ERC721 reverts with it (e.g. "NOT_MINTED"), so the types must admit it. */
export const exitErrorsAbi = [
  ...vaultAbi.filter((x) => x.type === "error"),
  ...positionManagerAbi.filter((x) => x.type === "error"),
  ...parseAbi(["error Error(string message)"]),
];
