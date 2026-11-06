import { addressUrl, deploy, txUrl } from "../chain/clients";
import { fmtInt, fmtTick, shortHash, type Position } from "../chain/model";
import { Flap } from "./Flap";

/** Source lines pinned to the commit the deployed contracts were built from (contracts/ unchanged since). */
const SRC = "https://github.com/emmanuelist/ripcord/blob/a7b4bbd68ddec105113e698e32d8c7b96c1b1c4c/contracts/src";

function Cite({ code, file, line }: { code: string; file: string; line: number }) {
  return (
    <figure className="cite">
      <code>{code}</code>
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

const contracts: { name: string; role: string; chain: "unichain" | "lasna"; address: string }[] = [
  { name: "RipcordVault", role: "Holds your lines; removes liquidity on a verified callback", chain: "unichain", address: deploy.ripcordVault },
  { name: "RipcordReactive", role: "Watches the pool's swaps; pulls the ripcord when a line is crossed", chain: "lasna", address: deploy.ripcordReactive },
  { name: "Callback proxy", role: "Reactive's relay into Unichain Sepolia", chain: "unichain", address: deploy.callbackProxy },
  { name: "Uniswap v4 PoolManager", role: "Emits the Swap event Ripcord reacts to", chain: "unichain", address: deploy.poolManager },
  { name: "Uniswap v4 PositionManager", role: "Owns the position NFTs the vault is approved on", chain: "unichain", address: deploy.positionManager },
];

export function Explainer({ p }: { p?: Position }) {
  const id = p ? `#${p.tokenId}` : "";
  return (
    <div className="explainer">
      <section id="how" className="ex-section" aria-labelledby="how-title">
        <h2 id="how-title">How a ripcord pulls</h2>
        <ol className="flow" aria-label="The three hops of one exit">
          <li>
            <Flap text="SWAP" tone="yellow" size="s" />
            <div>
              <h3>A swap moves the pool</h3>
              <p>On Unichain Sepolia, every swap in a Uniswap v4 pool emits a Swap event carrying the pool's new tick. An AMM price only moves through swaps, so no crossing goes unseen.</p>
              <Recorded label={`${id} crossing swap, tick → ${p?.swap?.tick !== undefined ? fmtTick(p.swap.tick) : "?"}, Unichain`} chain="unichain" hop={p?.swap} />
            </div>
            <Cite code="SYSTEM.subscribe(POOL_CHAIN_ID, POOL_MANAGER, SWAP_TOPIC, uint256(poolId), …);" file="RipcordReactive.sol" line={109} />
          </li>
          <li>
            <Flap text="REACT" tone="yellow" size="s" />
            <div>
              <h3>RipcordReactive checks the lines</h3>
              <p>On Reactive Lasna, a Reactive contract subscribed to that pool receives the event, compares the tick with every armed line, and requests one callback for each line it crosses.</p>
              <Recorded label={`${id} reaction, Lasna`} chain="lasna" hop={p?.lasna} />
            </div>
            <Cite code="if (line.exitBelow ? tick <= line.triggerTick : tick >= line.triggerTick) {" file="RipcordReactive.sol" line={137} />
          </li>
          <li>
            <Flap text="EXIT" tone="yellow" size="s" />
            <div>
              <h3>RipcordVault exits</h3>
              <p>Back on Unichain Sepolia, Reactive's callback proxy calls the vault, which accepts only RipcordReactive's callbacks, removes all of the position's liquidity, and sends both tokens to the NFT's owner.</p>
              <Recorded label={`${id} exit, Unichain`} chain="unichain" hop={p?.exit} />
            </div>
            <Cite code=") external onlyServiceProvider onlyCallbackSender(injectedSender) {" file="RipcordVault.sol" line={165} />
          </li>
        </ol>
        <p className="ex-note">Nothing of the owner's runs: no bot, no server, no open tab. The board above shows each loop's three transactions.</p>
      </section>

      <section className="ex-section split" aria-labelledby="custody-title">
        <h2 id="custody-title">What you give, what you keep</h2>
        <div className="prose">
          <p>You approve RipcordVault on your position NFT. You never hand it over: the NFT stays in your wallet before and after the exit.</p>
          <p>The exit removes liquidity only. It doesn't swap, and both tokens go to whoever holds the NFT at that moment. You can disarm a line at any time.</p>
        </div>
      </section>

      <section id="limits" className="ex-section split" aria-labelledby="limits-title">
        <h2 id="limits-title">Limits</h2>
        <ul className="limits">
          <li>Testnet only, on Unichain Sepolia and Reactive Lasna. The contracts are not audited.</li>
          <li>The exit lands blocks after the crossing swap, not at your exact price: one large swap can carry the price well past your line.</li>
          <li>At most 8 armed lines per pool, so a single swap can't push the reaction past Lasna's gas cap.</li>
          <li>No funding, no exit: RipcordReactive pays for reactions in lREACT and the vault pays callback gas in ETH.</li>
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
                  <th scope="row" data-label="Contract">{c.name}</th>
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
          Demo pool {shortHash(deploy.poolId)} uses test tokens RDA and RDB that Ripcord minted, because testnet v4 pools have no organic liquidity. Source and evidence:{" "}
          <a href="https://github.com/emmanuelist/ripcord">github.com/emmanuelist/ripcord</a>.
        </p>
      </section>

      <footer className="foot">Built for the Reactive Omni Buildathon, Every Second Counts track.</footer>
    </div>
  );
}
