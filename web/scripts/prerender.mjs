// After `vite build`: renders the page from the build-time snapshot and writes it into dist/index.html, so link previews,
// crawlers and AI judges read the whole first screen without running JavaScript. The client renders over it.
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const out = new URL("../dist/index.html", import.meta.url);
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
  const html = render();
  const page = readFileSync(out, "utf8");
  if (!page.includes('<div id="root"></div>')) throw new Error("no empty #root in dist/index.html");
  writeFileSync(out, page.replace('<div id="root"></div>', `<div id="root">${html}</div>`));
  console.log(`prerender: ${(html.length / 1024).toFixed(0)} kB of HTML into dist/index.html`);
} finally {
  await vite.close();
}
