import { useEffect, useState } from "react";
import { txUrl } from "../chain/clients";
import { fmtInt, fmtTick, shortHash } from "../chain/model";
import { readRefusals, type Refusals as R } from "../chain/refusals";
import { Flap } from "./Flap";

/** The vault's status words as the board shows them. */
const boardWord: Record<string, string> = { Armed: "ARMED", Exited: "DEPARTED", Failed: "CANCELLED", Disarmed: "DISARMED" };

const liq = (n: bigint) => {
  const s = n.toString();
  return s.length > 6 ? `${s[0]}.${s.slice(1, 3)}e${s.length - 1}` : s;
};
const lreact = (wei: bigint) => (Number(wei) / 1e18).toFixed(4);
const addr = (a: unknown) => shortHash(String(a));

function Tx({ chain, hop, label }: { chain: "unichain" | "lasna"; hop: { tx: string; block: bigint }; label: string }) {
  return (
    <>
      {label} <span className="num">#{fmtInt(hop.block)}</span>{" "}
      <a className="hash" href={txUrl(chain, hop.tx)} target="_blank" rel="noreferrer">
        {shortHash(hop.tx)}
      </a>
    </>
  );
}

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Three real attempts Ripcord refuses (E-016), each rebuilt from its own transactions: what happened is narrated with
 * values read back from chain, and the card beside it is what the chain says now. No value is stored in the page.
 */
export function Refusals() {
  const [r, setR] = useState<R | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stopped = false;
    readRefusals()
      .then((x) => !stopped && setR(x))
      .catch(() => !stopped && setFailed(true));
    return () => {
      stopped = true;
    };
  }, []);

  return (
    <section id="refusals" className="ex-section" aria-labelledby="refusals-title">
      <h2 id="refusals-title">What Ripcord refuses</h2>
      <p className="ex-lede">
        Three real attempts, each read back from chain by its own transactions: a swap that stops short, an exit called by the wrong sender, and an exit the
        owner no longer allows.
      </p>
      {!r ? (
        <p className="ex-note">{failed ? "The public RPCs didn't answer. The three refusals load once they do." : "Reading the three refusals back from Unichain Sepolia and Lasna…"}</p>
      ) : (
        <ol className="flow refusals" aria-label="Three refused attempts">
          <li>
            <div className="flow-text">
              <h3>
                <Flap text="HELD" tone="yellow" size="s" /> <span>A swap that stops short of the line</span>
              </h3>
              <p>
                #{String(r.holds.tokenId)}'s line sat at <span className="num">{fmtTick(r.holds.line)}</span>. A swap moved the pool from{" "}
                <span className="num">{fmtTick(r.holds.tickBefore)}</span> to <span className="num">{fmtTick(r.holds.tickAfter)}</span>: toward the line,{" "}
                <span className="num">{fmtInt(Math.abs(r.holds.tickAfter - r.holds.line))}</span> ticks short. RipcordReactive still reacted on Lasna
                {r.holds.reaction.charge !== undefined && (
                  <>
                    {" "}
                    and was billed <span className="num">{lreact(r.holds.reaction.charge)}</span> <span className="ticker">lREACT</span>
                  </>
                )}
                , but asked for no callback.
              </p>
              <p className="recorded">
                <Tx chain="unichain" hop={r.holds.swap} label="Swap, Unichain" /> · <Tx chain="lasna" hop={r.holds.reaction} label="reaction, Lasna" />
              </p>
            </div>
            <div className="chain-says">
              <p className="cite-k">Read back now</p>
              <dl>
              <Fact k="Lasna reaction">
                {r.holds.reaction.ok ? "succeeded" : "failed"} · {r.holds.reaction.events} events · no callback
              </Fact>
              <Fact k={`#${r.holds.tokenId} liquidity`}>
                <span className="num">{liq(r.holds.liquidityBefore)}</span> before · <span className="num">{liq(r.holds.liquidity)}</span> now
              </Fact>
              </dl>
            </div>
          </li>

          <li>
            <div className="flow-text">
              <h3>
                <Flap text="REVERTED" tone="red" size="s" /> <span>An exit called by anyone but Reactive</span>
              </h3>
              <p>
                The project wallet called <code className="inline">RipcordVault.exit</code> on #{String(r.direct.tokenId)} itself, posing as RipcordReactive (
                <span className="hash">{addr(r.direct.claimedSender)}</span>) with a crossing tick. The chain {r.direct.tx.reverted ? "reverted it" : "did not revert it"}:
                only Reactive's callback proxy may call exit. Then the owner disarmed the line, which an owner can always do.
              </p>
              <p className="recorded">
                <Tx chain="unichain" hop={r.direct.tx} label="Reverted call, Unichain" /> · <Tx chain="unichain" hop={r.direct.disarm} label="disarm" />
              </p>
            </div>
            <div className="chain-says">
              <p className="cite-k">The chain's reason</p>
              <dl>
              <Fact k="Replayed one block earlier">
                {r.direct.reason ? (
                  <code>
                    {r.direct.reason.name}({r.direct.reason.args.map(addr).join(", ")})
                  </code>
                ) : (
                  "unreadable from this RPC"
                )}
              </Fact>
              <Fact k="Means">the sender is not Reactive's callback proxy</Fact>
              <Fact k={`#${r.direct.tokenId} now`}>
                <Flap text={boardWord[r.direct.statusNow] ?? r.direct.statusNow.toUpperCase()} tone="dim" size="s" /> · liquidity{" "}
                <span className="num">{liq(r.direct.liquidity)}</span>, as before
              </Fact>
              </dl>
            </div>
          </li>

          <li>
            <div className="flow-text">
              <h3>
                <Flap text="CANCELLED" tone="red" size="s" /> <span>An exit after the owner revoked approval</span>
              </h3>
              <p>
                #{String(r.custody.tokenId)}'s owner revoked the vault's approval. Then a swap crossed its line at <span className="num">{fmtTick(r.custody.line)}</span> (
                <span className="num">{fmtTick(r.custody.tickBefore)}</span> → <span className="num">{fmtTick(r.custody.tickAfter)}</span>).{" "}
                {r.custody.lasna.pulled ? "Lasna pulled the ripcord" : "Lasna reacted"}, but the vault could not touch the NFT: it recorded the refusal on-chain,{" "}
                <span className="num">{fmtInt(Number(r.custody.failed.block - r.custody.swap.block))}</span> blocks after the swap, instead of failing silently.
              </p>
              <p className="recorded">
                <Tx chain="unichain" hop={r.custody.revoke} label="Revoke, Unichain" /> · <Tx chain="unichain" hop={r.custody.swap} label="swap" /> ·{" "}
                <Tx chain="lasna" hop={r.custody.lasna} label="pull, Lasna" /> · <Tx chain="unichain" hop={r.custody.failed} label="refusal" />
              </p>
            </div>
            <div className="chain-says">
              <p className="cite-k">The vault's record</p>
              <dl>
              <Fact k="ExitFailed reason">
                {r.custody.failed.reason ? (
                  <code>
                    {r.custody.failed.reason.name}({r.custody.failed.reason.args.map(addr).join(", ")})
                  </code>
                ) : (
                  "unreadable from this RPC"
                )}
              </Fact>
              <Fact k="Means">the PositionManager refused RipcordVault</Fact>
              <Fact k={`#${r.custody.tokenId} now`}>
                <Flap text={boardWord[r.custody.statusNow] ?? r.custody.statusNow.toUpperCase()} tone="red" size="s" /> · liquidity{" "}
                <span className="num">{liq(r.custody.liquidity)}</span>, as before
              </Fact>
              </dl>
            </div>
          </li>
        </ol>
      )}
    </section>
  );
}
