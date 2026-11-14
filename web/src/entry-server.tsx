import { renderToString } from "react-dom/server";
import { App } from "./App";

/** The first screen as HTML, rendered from the build-time snapshot (scripts/prerender.mjs). The client replaces it. */
export function render(): string {
  return renderToString(<App />);
}
