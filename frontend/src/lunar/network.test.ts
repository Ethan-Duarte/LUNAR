import { describe, it, expect } from "vitest";
import {
  distanceKm,
  layoutGeometry,
  lineOfSight,
  simultaneous,
  type Facility,
} from "./network";
const a: Facility = {
  id: "a",
  name: "Hub",
  role: "habitat",
  lat: 0,
  lon: 0,
  mast: 2,
};
const b: Facility = { ...a, id: "b", role: "landing", lon: 0.1 };
const c: Facility = { ...a, id: "c", role: "power", lon: 0.2 };
describe("base-layout screening", () => {
  it("uses spherical arc distance, including wrapped longitude and polar positions", () => {
    expect(distanceKm(a, b)).toBeCloseTo((1737.4 * Math.PI) / 1800, 9);
    expect(distanceKm({ ...a, lon: 359.9 }, a)).toBeCloseTo(
      distanceKm(a, b),
      8,
    );
    expect(distanceKm({ ...a, lat: -90 }, { ...b, lat: -90 })).toBeLessThan(
      1e-9,
    );
  });
  it("minimizes geometric tree length and detects user-defined separation conflicts", () => {
    const r = layoutGeometry([a, b, c], 4, 4);
    expect(r.tree).toHaveLength(2);
    expect(r.totalKm).toBeCloseTo(2 * distanceKm(a, b), 8);
    expect(r.connected).toBe(true);
    expect(r.conflicts).toHaveLength(1);
    expect(layoutGeometry([a, b], 1, 0).connected).toBe(false);
  });
  it("distinguishes geometric visibility from curvature blockage on measured-source injection", () => {
    const global = { width: 4, height: 2, h: new Float32Array(8) };
    expect(
      lineOfSight(a, { ...b, lon: 0.001 }, { terrains: [], global }).status,
    ).toBe("clear");
    expect(
      lineOfSight(a, { ...b, lon: 1 }, { terrains: [], global }).status,
    ).toBe("blocked");
  });
  it("does not multiply independent availability percentages", () => {
    expect(
      simultaneous([
        [true, false],
        [false, true],
      ]),
    ).toBe(0);
    expect(
      simultaneous([
        [true, false],
        [true, true],
      ]),
    ).toBe(0.5);
    expect(() => simultaneous([[true], [true, false]])).toThrow();
    expect(simultaneous([])).toBe(null);
  });
});
