import { Composition } from "remotion";
import { Ripcord } from "./Ripcord";
import { FPS, TOTAL_S } from "./timeline";

export const Root = () => (
  <Composition id="Ripcord" component={Ripcord} durationInFrames={Math.ceil(TOTAL_S * FPS)} fps={FPS} width={1920} height={1080} />
);
