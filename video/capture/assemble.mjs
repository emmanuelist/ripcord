// Turns the screencast's frames (painted only on change, each with its own time) into constant-rate footage:
// every frame is held until the next one was painted, so timing is exactly the page's. Out: public/capture/take.mp4.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../public/capture/", import.meta.url).pathname;
const { frames } = JSON.parse(readFileSync(`${dir}take.json`, "utf8"));
let list = "";
frames.forEach((f, i) => {
  const d = i + 1 < frames.length ? frames[i + 1].t - f.t : 1;
  list += `file frames/${f.file}\nduration ${d.toFixed(4)}\n`;
});
list += `file frames/${frames.at(-1).file}\n`;
writeFileSync(`${dir}list.txt`, list);
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${dir}list.txt`, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "12", "-preset", "slow", `${dir}take.mp4`], { cwd: dir });
console.log(`take.mp4 from ${frames.length} frames, ${frames.at(-1).t.toFixed(1)} s`);
