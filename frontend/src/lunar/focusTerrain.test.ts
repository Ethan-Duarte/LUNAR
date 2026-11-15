import { it, expect } from "vitest";
import { focusTerrain } from "./focusTerrain";
import { sampleDir } from "../lib/terrain";
import { upVector } from "../lib/geo";
it("centres the rendered mesh on the same measured elevation as the observer at equatorial and polar sites", () => {
  const global = { width: 8, height: 4, h: new Float32Array(32).fill(1234) };
  for (const [lat, lon] of [
    [-89.4, 222.85],
    [26.13, 3.63],
    [0, 180],
    [89.8, -120],
  ]) {
    const t = focusTerrain({ terrains: [], global }, lat, lon);
    expect(sampleDir(t, ...upVector(lat, lon))).toBeCloseTo(1234, 3);
  }
});
