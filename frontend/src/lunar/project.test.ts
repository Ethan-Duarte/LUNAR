import { it, expect } from "vitest";
import { observationProject } from "./project";
const fixture = {
  schema: "lunar-project-1",
  pins: [{ lat: -89, lon: 222, label: "Hub" }],
  time: 1794614400000,
  observer: 10,
  criteria: { minSunFrac: 0.999, earthMaskDeg: 5 },
  quality: "high",
  layer: "natural",
};
it("preserves shared scientific and display assumptions in a valid observation project", () => {
  const p = observationProject(fixture);
  expect(p.criteria.earthMaskDeg).toBe(5);
  expect(p.observer).toBe(10);
  expect(p.time).toBe(fixture.time);
});
it("rejects invalid coordinates and assumptions before state can be changed", () => {
  expect(() =>
    observationProject({ ...fixture, pins: [{ lat: 91, lon: 0 }] }),
  ).toThrow();
  expect(() =>
    observationProject({
      ...fixture,
      criteria: { minSunFrac: 2, earthMaskDeg: 0 },
    }),
  ).toThrow();
  expect(() => observationProject({ ...fixture, observer: -1 })).toThrow();
});
