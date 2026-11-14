import { addressUrl, deploy, txUrl } from "../chain/clients";
import type { Funding } from "../chain/funding";
import { crosses, fmtAmount, fmtInt, fmtTick, shortHash, type Position } from "../chain/model";
import { useCustody } from "../chain/useCustody";
import { Flap } from "./Flap";
import { Refusals } from "./Refusals";

/** Source lines pinned to the commit the deployed contracts were built from (contracts/ unchanged since). */
const SRC = "https://github.com/emmanuelist/ripcord/blob/a7b4bbd68ddec105113e698e32d8c7b96c1b1c4c/contracts/src";

/** A cited source line, and what it evaluated to in one real recorded loop. */
function Cite({ code, file, line, evaluated }: { code: string; file: string; line: number; evaluated?: string }) {
  return (
    <figure className="cite">
      <code>{code}</code>
      {evaluated && (
        <p className="cite-eval">
          <span className="cite-k">This loop</span> <code>{evaluated}</code>
        </p>
      )}
      <figcaption>
        <a href={`${SRC}/${file}#L${line}`} target="_blank" rel="noreferrer">
          {file}:{line}
        </a>
      </figcaption>
    </figure>
  );
}

function Recorded({ label, chain, hop }: { label: string; chain: "unichain" | "lasna"; hop?: { tx: string; block: bigint } }) {
  if (!hop) return null;
  return (
    <p className="recorded">
      {label} <span className="num">#{fmtInt(hop.block)}</span>{" "}
      <a className="hash" href={txUrl(chain, hop.tx)} target="_blank" rel="noreferrer">
        {shortHash(hop.tx)}
      </a>
    </p>
  );
}

const sci = (n: bigint) => {
  const s = n.toString();
  return s.length > 6 ? `${s[0]}.${s.slice(1, 3)}e${s.length - 1}` : s;
};

const contracts: { name: string; role: string; chain: "unichain" | "lasna"; address: string }[] = [
  { name: "RipcordVault", role: "Holds your lines; removes liquidity on a verified callback", chain: "unichain", address: deploy.ripcordVault },
  { name: "RipcordReactive", role: "Watches the pool's swaps; pulls the ripcord when a line is crossed", chain: "lasna", address: deploy.ripcordReactive },
  { name: "Callback proxy", role: "Reactive's relay into Unichain Sepolia", chain: "unichain", address: deploy.callbackProxy },
  { name: "Uniswap v4 PoolManager", role: "Emits the Swap event Ripcord reacts to", chain: "unichain", address: deploy.poolManager },
  { name: "Uniswap v4 PositionManager", role: "Owns the position NFTs the vault is approved on", chain: "unichain", address: deploy.positionManager },
];

export function Explainer({ p, armed, funding }: { p?: Position; armed: number; funding?: Funding }) {
  const id = p ? `#${p.tokenId}` : "";
  const seen = p?.lasna?.observedTick ?? p?.swap?.tick;
  const reactEval =
    p && seen !== undefined
      ? `exitBelow = ${p.exitBelow}: tick ${fmtTick(seen)} ${p.exitBelow ? "<=" : ">="} triggerTick ${fmtTick(p.line)} → ${crosses(seen, p.line, p.exitBelow)}`
      : undefined;
  const exitEval = p?.exit
    ? `liquidity ${sci(p.exit.liquidity)} → 0; ${fmtAmount(p.exit.amount0)} RDA + ${fmtAmount(p.exit.amount1)} RDB to ${p.owner ? shortHash(p.owner) : "the owner"}`
    : undefined;
  const reactiveCovers = funding?.reactive.covers;
  const custody = useCustody(p);

  return (
    <div className="explainer">
      <section id="how" className="ex-section" aria-labelledby="how-title">
        <h2 id="how-title">How a ripcord pulls</h2>
        <ol className="flow" aria-label="The three hops of one exit">
          <li>
            <div className="flow-text">
              <h3>
                <Flap text="SWAP" tone="yellow" size="s" /> <span>The pool's tick moves</span>
              </h3>
              <p>On Unichain Sepolia, every swap in a Uniswap v4 pool emits a Swap event carrying the pool's new tick. An AMM price only moves through swaps, so no crossing goes unseen.</p>
              <Recorded label={`${id} crossing swap, Unichain`} chain="unichain" hop={p?.swap} />
            </div>
            <div className="flow-cites">
              <Cite
                code="SYSTEM.subscribe(POOL_CHAIN_ID, POOL_MANAGER, SWAP_TOPIC, uint256(poolId), …);"
                file="RipcordReactive.sol"
                line={109}
                evaluated={`poolId = ${shortHash(deploy.poolId)}, the demo pool`}
              />
            </div>
          </li>
          <li>
            <div className="flow-text">
              <h3>
                <Flap text="REACT" tone="yellow" size="s" /> <span>RipcordReactive checks every line</span>
              </h3>
              <p>On Reactive Lasna, a Reactive contract subscribed to that pool receives the event, compares the tick with every armed line, and requests one callback for each line it crosses.</p>
              <Recorded label={`${id} reaction, Lasna`} chain="lasna" hop={p?.lasna} />
            </div>
            <div className="flow-cites">
              <Cite code="if (line.exitBelow ? tick <= line.triggerTick : tick >= line.triggerTick) {" file="RipcordReactive.sol" line={137} evaluated={reactEval} />
            </div>
          </li>
          <li>
            <div className="flow-text">
              <h3>
                <Flap text="EXIT" tone="yellow" size="s" /> <span>RipcordVault removes the liquidity</span>
              </h3>
              <p>Back on Unichain Sepolia, Reactive's callback proxy calls the vault, which accepts only RipcordReactive's callbacks, removes all of the position's liquidity, and sends both tokens to the NFT's owner.</p>
              <Recorded label={`${id} exit, Unichain`} chain="unichain" hop={p?.exit} />
            </div>
            <div className="flow-cites">
              <Cite code=") external onlyServiceProvider onlyCallbackSender(injectedSender) {" file="RipcordVault.sol" line={165} />
              <Cite code="POSITION_MANAGER.modifyLiquidities(abi.encode(actions, params), block.timestamp);" file="RipcordVault.sol" line={220} evaluated={exitEval} />
            </div>
          </li>
        </ol>
        <p className="ex-note">Nothing of the owner's runs: no bot, no server, no open tab. The board above shows each loop's three transactions.</p>
        <p className="ex-note">
          Why the seconds matter: on Reactive's previous version, blocks came every ~7 s. In the worst half hour of the 10 Oct 2025 crash, ETH fell a median 25.0 bps
          within 7 s of any second, against 15.7 bps within 3 s, Ripcord's slowest loop (Binance 1-second candles).
        </p>
      </section>

      <Refusals />

      <section className="ex-section split" aria-labelledby="custody-title">
        <h2 id="custody-title">What you give, what you keep</h2>
        <div className="prose">
          <p>You approve RipcordVault on your position NFT. You never hand it over: the NFT stays in your wallet before and after the exit.</p>
          <p>The exit removes liquidity only. It doesn't swap, and both tokens go to whoever holds the NFT at that moment. You can disarm a line at any time.</p>
          {custody && (
            <p className="read-now">
              <span className="cite-k">Read now</span> #{String(custody.tokenId)}'s owner, from the PositionManager: the block before its exit (
              <span className="num">#{fmtInt(custody.beforeBlock)}</span>){" "}
              <a className="hash" href={addressUrl("unichain", custody.before)} target="_blank" rel="noreferrer">
                {shortHash(custody.before)}
              </a>
              ; now{" "}
              <a className="hash" href={addressUrl("unichain", custody.now)} target="_blank" rel="noreferrer">
                {shortHash(custody.now)}
              </a>
              {custody.before.toLowerCase() === custody.now.toLowerCase() ? ", the same wallet." : "."}
            </p>
          )}
        </div>
      </section>

      <section id="limits" className="ex-section split" aria-labelledby="limits-title">
        <h2 id="limits-title">Limits</h2>
        <ul className="limits">
          <li>Testnet only, on Unichain Sepolia and Reactive Lasna. The contracts are not audited.</li>
          <li>The exit lands blocks after the crossing swap, not at your exact price: one large swap can carry the price well past your line.</li>
          <li>
            At most 8 armed lines per pool, so a single swap can't push the reaction past Lasna's gas cap. <span className="live-fact num">{armed} of 8 armed now.</span>
          </li>
          <li>
            No funding, no exit: RipcordReactive pays for reactions in <span className="ticker">lREACT</span> and the vault pays callback gas in ETH.{" "}
            {reactiveCovers !== undefined && (
              <a className="live-fact num" href="#board">
                RipcordReactive covers {fmtInt(reactiveCovers)} more {reactiveCovers === 1 ? "exit" : "exits"} now.
              </a>
            )}
          </li>
          <li>Revoke the approval, move the NFT, or add a subscriber, and the exit is refused on-chain. The board marks it cancelled with the reason.</li>
          <li>This page reads public RPCs. It shows the recorded loops and anything that happens while it is open.</li>
        </ul>
      </section>

      <section id="contracts" className="ex-section" aria-labelledby="contracts-title">
        <h2 id="contracts-title">Contracts</h2>
        <div className="contracts-wrap" role="region" aria-labelledby="contracts-title" tabIndex={0}>
          <table className="contracts">
            <thead>
              <tr>
                <th scope="col">Contract</th>
                <th scope="col">Role</th>
                <th scope="col">Network</th>
                <th scope="col">Address</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.name}>
                  <th scope="row" data-label="Contract">
                    {c.name}
                  </th>
                  <td data-label="Role">{c.role}</td>
                  <td data-label="Network">{c.chain === "unichain" ? "Unichain Sepolia" : "Reactive Lasna"}</td>
                  <td data-label="Address">
                    <a className="hash" href={addressUrl(c.chain, c.address)} target="_blank" rel="noreferrer">
                      {shortHash(c.address)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ex-note">
          Demo pool {shortHash(deploy.poolId)} pairs RDA and RDB, test tokens the Ripcord project wallet deployed for the demo. Source and evidence:{" "}
          <a href="https://github.com/emmanuelist/ripcord">github.com/emmanuelist/ripcord</a>.
        </p>
      </section>

      <footer className="foot">Built for the Reactive Omni Buildathon, Every Second Counts track.</footer>
    </div>
  );
}
