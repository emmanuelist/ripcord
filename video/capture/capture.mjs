// Records one continuous take of the public Ripcord page while a real tryout loop runs (docs/VIDEO.md).
//
// Chrome's own screencast saves every painted frame with its timestamp, so the footage is the page at chain speed:
// nothing is sped up or staged. While it records, the project wallet sends RipcordTryout.arm() and cross(tokenId).
// Signing goes through `cast` with the encrypted keystore (D-007), so the key never enters Node, and nothing about the
// wallet is ever on screen: the browser shows only the public page.
//
// Out: public/capture/frames/*.jpg, public/capture/take.json (frame times, beat marks, the loop's tx hashes).
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { chromium } from "playwright";

const run = promisify(execFile);
const ROOT = new URL("../", import.meta.url);
const OUT = new URL("public/capture/", ROOT);
const FRAMES = new URL("frames/", OUT);
const PAGE = process.env.PAGE_URL ?? "https://ripcord-ashy.vercel.app";
const TRYOUT = "0xfDF1b11aae05a8a0620Fe56AD3C9A2Bd7431A698";

// .env values (never printed): RPC, account name and password file for cast.
const env = Object.fromEntries(
  (await readFile(new URL("../.env", ROOT), "utf8"))
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const RPC = env.UNICHAIN_SEPOLIA_RPC;
const sign = ["--rpc-url", RPC, "--account", env.ACCOUNT, "--password-file", env.KEYSTORE_PASSWORD_FILE];

async function send(sig, ...args) {
  const { stdout } = await run("cast", ["send", ...sign, "--json", TRYOUT, sig, ...args]);
  const r = JSON.parse(stdout);
  if (r.status !== "0x1") throw new Error(`${sig} reverted: ${r.transactionHash}`);
  return r;
}

const t0 = Date.now();
const marks = [];
const mark = (name, extra = {}) => {
  const m = { name, t: (Date.now() - t0) / 1000, ...extra };
  marks.push(m);
  console.log(`${m.t.toFixed(1).padStart(6)} s  ${name}`, Object.keys(extra).length ? JSON.stringify(extra) : "");
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await rm(OUT, { recursive: true, force: true });
await mkdir(FRAMES, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "no-preference" });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

const frames = [];
let n = 0;
const pending = [];
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const file = `f${String(n++).padStart(6, "0")}.jpg`;
  frames.push({ file, ts: metadata.timestamp });
  pending.push(writeFile(new URL(file, FRAMES), Buffer.from(data, "base64")));
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
// Every failed or non-2xx request, with its time on this script's clock: an RPC hiccup on camera gets a cause.
const badRequests = [];
page.on("requestfailed", (r) => badRequests.push({ t: (Date.now() - t0) / 1000, url: r.url(), error: r.failure()?.errorText }));
page.on("response", (r) => r.status() >= 400 && badRequests.push({ t: (Date.now() - t0) / 1000, url: r.url(), status: r.status() }));

await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 3840, maxHeight: 2160, everyNthFrame: 1 });
mark("navigate");
await page.goto(PAGE, { waitUntil: "load" });
// Loaded when the board has its rows and the featured departure has a replay (the newest real departure).
await page.waitForSelector("#departure .replay", { timeout: 60_000 });
await page.waitForFunction(() => document.querySelectorAll("#board tbody tr").length > 40, null, { timeout: 60_000 });
mark("loaded");
await sleep(9_000); // the cold open and the "how" line play over the settled page

// The cooldown is across callers: wait it out rather than revert on camera.
const lastArm = BigInt((await run("cast", ["call", "--rpc-url", RPC, TRYOUT, "lastArmAt()(uint256)"])).stdout.trim().split(" ")[0]);
const wait = Number(lastArm) + 61 - Math.floor(Date.now() / 1000);
if (wait > 0) {
  mark("cooldown-wait", { seconds: wait });
  await sleep(wait * 1000);
}

mark("arm-sent");
const arm = await send("arm()");
const armLog = arm.logs.find((l) => l.address.toLowerCase() === TRYOUT.toLowerCase());
const id = BigInt(armLog.topics[2]).toString();
mark("arm-mined", { tx: arm.transactionHash, block: Number(arm.blockNumber), tokenId: id });

await page.waitForSelector(`#departure[aria-label="Departure of position ${id}"]`, { timeout: 60_000 });
mark("armed-on-page");
await sleep(7_000); // Lasna starts tracking the new line (README: give it ~5 s)

mark("cross-sent");
const cross = await send("cross(uint256)", id);
mark("cross-mined", { tx: cross.transactionHash, block: Number(cross.blockNumber) });

await page.waitForSelector(`#departure[aria-label="Departure of position ${id}"] .replay`, { timeout: 120_000 });
mark("departed-on-page");
await sleep(9_000);

await page.click("#departure .replay");
mark("replay");
await page.waitForSelector("#departure .replay:not([disabled])", { timeout: 60_000 });
mark("replay-done");
await sleep(3_000);

const glide = async (sel, name, hold, block = "start") => {
  await page.evaluate(
    ([s, b]) => document.querySelector(s)?.scrollIntoView({ behavior: "smooth", block: b }),
    [sel, block],
  );
  mark(name);
  await sleep(hold);
};
// Down the page in its own order: the board, the why-it-matters note, then the refusal room; then back to the top.
await glide("#board", "board", 10_000);
await page.evaluate(() => {
  const note = [...document.querySelectorAll(".ex-note")].find((p) => p.textContent?.startsWith("Why the seconds matter"));
  note?.setAttribute("data-capture", "why");
});
await glide('[data-capture="why"]', "why", 14_000, "center");
await glide("#refusals", "refusals", 5_000);
await glide("#refusals-a", "refusal-a", 9_000, "center");
await glide("#refusals-b", "refusal-b", 9_000, "center");
await glide("#refusals-c", "refusal-c", 11_000, "center");
await glide("#top", "top", 14_000);
mark("end");

await cdp.send("Page.stopScreencast");
await Promise.all(pending);
await browser.close();

const first = frames[0].ts;
await writeFile(
  new URL("take.json", OUT),
  JSON.stringify(
    {
      page: PAGE,
      recordedAt: new Date(t0).toISOString(),
      tokenId: id,
      arm: { tx: arm.transactionHash, block: Number(arm.blockNumber) },
      cross: { tx: cross.transactionHash, block: Number(cross.blockNumber) },
      // Frame times are on Chrome's screencast clock; marks are on this script's clock, offset to the first frame.
      clockOffset: (frames[0].ts * 1000 - t0) / 1000,
      frames: frames.map((f) => ({ file: f.file, t: f.ts - first })),
      marks,
      consoleErrors,
      badRequests,
    },
    null,
    2,
  ),
);
console.log(`frames ${frames.length}, tokenId ${id}, console errors ${consoleErrors.length}, bad requests ${badRequests.length}`);
for (const b of badRequests) console.log(JSON.stringify(b));
