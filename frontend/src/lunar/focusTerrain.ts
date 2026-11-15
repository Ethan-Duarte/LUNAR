// Display-only remesh of measured terrain. Resampling adds no measured resolution.
import { upVector } from "../lib/geo";
import {
  frameDirection,
  patchFrame,
  sourceHeight,
  sampleDir,
  type HeightSource,
  type Terrain,
} from "../lib/terrain";
export function focusTerrain(
  source: HeightSource,
  lat: number,
  lon: number,
): Terrain {
  const native =
    source.terrains
      .find((t) => Number.isFinite(sampleDir(t, ...upVector(lat, lon))))
      ?.levels.at(-1)?.pixel ?? 80;
  const pixel = native <= 20 ? 40 : 80,
    size = pixel === 40 ? 513 : 257,
    half = (size * pixel) / 2,
    frame = patchFrame(lat, lon),
    radiusM = 1737400;
  const h = new Float32Array(size * size);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const d = frameDirection(
        frame,
        -half + (i + 0.5) * pixel,
        half - (j + 0.5) * pixel,
        radiusM,
      );
      h[j * size + i] = sourceHeight(source, ...d);
    }
  return {
    id: "observer-focus",
    radiusM,
    frame,
    levels: [
      { size, pixel, xMin: -half, xMax: half, yMin: -half, yMax: half, h },
    ],
  };
}
