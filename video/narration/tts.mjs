// Generates each narration line with ElevenLabs (docs/VIDEO.md). The key is read from .env and never printed.
// Out: public/narration/<id>.mp3 and public/narration/durations.json. Skips lines already generated, to save quota.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("public/narration/", ROOT);
const VOICE = process.env.VOICE_ID ?? "onwK4e9ZLuTAKqWW03F9"; // Daniel, "Steady Broadcaster"
const MODEL = "eleven_multilingual_v2";
const key = (await readFile(new URL("../.env", ROOT), "utf8")).match(/^ELEVENLABS_API_KEY=(.*)$/m)?.[1]?.trim();
if (!key) throw new Error("ELEVENLABS_API_KEY is not set in .env");

const lines = JSON.parse(await readFile(new URL("narration/lines.json", ROOT), "utf8"));
const only = process.argv.slice(2);
await mkdir(OUT, { recursive: true });
const durations = {};
for (const l of lines) {
  const file = new URL(`${l.id}.mp3`, OUT);
  if (only.length ? only.includes(l.id) : !existsSync(file)) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text: l.text, model_id: MODEL, voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.1, speed: Number(process.env.SPEED ?? 1.0) } }),
    });
    if (!res.ok) throw new Error(`${l.id}: ${res.status} ${await res.text()}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    console.log(`generated ${l.id}`);
  }
  durations[l.id] = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file.pathname]).toString().trim());
}
await writeFile(new URL("durations.json", OUT), JSON.stringify(durations, null, 2));
console.log(durations);
