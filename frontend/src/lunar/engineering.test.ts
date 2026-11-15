import { describe, it, expect } from "vitest";
import {
  simulatePower,
  minimumBattery,
  panelGeneration,
  evaluateDesign,
  reachable,
  rankDesigns,
  DEFAULT_ENGINEERING as S,
  type FacilityProfile,
  type Link,
} from "./engineering";
import type { Facility } from "./network";
import { uncoveredDisc } from "../lib/windows";
const h: Facility = {
  id: "h",
  name: "Habitat",
  role: "habitat",
  lat: 0,
  lon: 0,
  mast: 2,
  fixed: true,
};
const a: Facility = {
  ...h,
  id: "a",
  name: "Array",
  role: "power",
  lon: 0.001,
  areaM2: 10,
};
const profile = (
  id: string,
  sun = [1, 1, 0, 0],
  earth = [true, true, true, true],
): FacilityProfile => ({
  id,
  sun,
  terrainSun: [1, 1, 1, 1],
  eclipse: [1, 1, 0, 0],
  earth,
  sunEl: [90, 90, 90, 90],
  slope: 0,
  terrain: "analytic fixture",
});
const link: Link = {
  a: "h",
  b: "a",
  km: 0.03,
  status: "clear",
  minClearanceM: 1,
};
const settings = {
  ...S,
  stepMinutes: 60,
  loadKW: 1,
  batteryKWh: 10,
  reserveSoc: 0,
  efficiency: 1,
  derate: 1,
  solarFlux: 1000,
  cableLossPerKm: 0,
  requireEarth: true,
};
describe("electrical bookkeeping and sizing", () => {
  it("closes energy balance with charging, discharge, curtailment and unmet demand", () => {
    const r = simulatePower([5, 0, 0, 8, 0], 2, 1, {
      batteryKWh: 3,
      initialSoc: 0.4,
      chargeEfficiency: 0.8,
      dischargeEfficiency: 0.9,
    });
    expect(r.generatedKWh + r.initialKWh).toBeCloseTo(
      r.loadKWh -
        r.unmetKWh +
        r.finalKWh +
        r.chargeLossKWh +
        r.dischargeLossKWh +
        r.curtailedKWh,
      10,
    );
    expect(r.socKWh.every((v) => v >= 0 && v <= 3)).toBe(true);
  });
  it("matches an analytic dark-period discharge including efficiency", () => {
    const r = simulatePower([0, 0], 2, 1, {
      batteryKWh: 10,
      initialSoc: 1,
      chargeEfficiency: 1,
      dischargeEfficiency: 0.8,
    });
    expect(r.finalKWh).toBeCloseTo(5);
    expect(r.unmetKWh).toBe(0);
  });
  it("sizes usable storage from reserve and discharge losses", () => {
    const r = minimumBattery([0, 0], 2, 1, {
      ...S,
      initialSoc: 1,
      reserveSoc: 0.2,
      dischargeEfficiency: 0.8,
    });
    expect(r).toBeCloseTo(6.25, 4);
  });
  it("reports impossible reserve when initial SOC is below reserve", () => {
    expect(
      minimumBattery([0], 1, 1, { ...S, initialSoc: 0.1, reserveSoc: 0.2 }),
    ).toBeNull();
  });
  it("rejects nonphysical electrical settings", () => {
    expect(() => simulatePower([-1], 1, 1, S)).toThrow();
    expect(() => simulatePower([1], 1, 0, S)).toThrow();
    expect(() =>
      simulatePower([1], 1, 1, { ...S, chargeEfficiency: 0 }),
    ).toThrow();
  });
  it("scales array output and handles horizontal cosine incidence", () => {
    const p = profile("a");
    expect(panelGeneration(a, p, settings)).toEqual([10, 10, 0, 0]);
    expect(panelGeneration({ ...a, areaM2: 20 }, p, settings)[0]).toBe(20);
    expect(
      panelGeneration(
        a,
        { ...p, sunEl: [30, 30, 30, 30] },
        { ...settings, panelMode: "horizontal" },
      )[0],
    ).toBeCloseTo(5);
  });
});
describe("connected mission decisions", () => {
  it("isolates eclipse generation loss from geometric Earth contact", () => {
    const r = evaluateDesign(
      [h, a],
      [profile("h"), profile("a")],
      [link],
      settings,
    );
    expect(r.eclipseEvents).toEqual([
      { startIndex: 2, endIndex: 4, minVisible: 0 },
    ]);
    expect(r.eclipseLostGenerationKWh).toBeCloseTo(20);
    expect(r.contactShare).toBe(1);
    expect(r.feasible).toBe(true);
  });
  it("does not deliver distant disconnected solar power magically", () => {
    const r = evaluateDesign(
      [h, a],
      [profile("h"), profile("a")],
      [{ ...link, status: "blocked" }],
      settings,
    );
    expect(r.electricalConnected).toBe(false);
    expect(r.generation).toEqual([0, 0, 0, 0]);
    expect(r.feasible).toBe(false);
  });
  it("routes Earth access through a connected relay and forbids a disconnected one", () => {
    const relay = { ...h, id: "r", name: "Tower", role: "relay" as const };
    const p = [
      profile("h", [1, 1, 1, 1], [false, false, false, false]),
      profile("a"),
      profile("r"),
    ];
    const edge = { ...link, a: "h", b: "r" };
    expect(
      evaluateDesign([h, a, relay], p, [link, edge], settings).contactShare,
    ).toBe(1);
    expect(
      evaluateDesign(
        [h, a, relay],
        p,
        [link, { ...edge, status: "blocked" }],
        settings,
      ).contactShare,
    ).toBe(0);
  });
  it("respects radio node types and distance limits", () => {
    const links = [link, { ...link, a: "a", b: "r" }];
    expect([...reachable("h", links, 1, new Set(["h", "r"]))]).toEqual(["h"]);
    expect(reachable("h", links, 0.001).size).toBe(1);
  });
  it("retains unsafe slope and pad conflicts as failures", () => {
    const pad = { ...h, id: "p", name: "Pad", role: "landing" as const };
    const r = evaluateDesign(
      [h, a, pad],
      [{ ...profile("h"), slope: 20 }, profile("a"), profile("p")],
      [link],
      settings,
    );
    expect(r.failures.some((x) => x.includes("Slope"))).toBe(true);
    expect(r.failures.some((x) => x.includes("exclusion"))).toBe(true);
  });
  it("reports unknown slope instead of inventing a flat site", () => {
    const r = evaluateDesign(
      [h, a],
      [{ ...profile("h"), slope: null }, profile("a")],
      [link],
      settings,
    );
    expect(r.feasible).toBe(false);
  });
  it("keeps feasible designs above visually attractive infeasible ones", () => {
    const base = {
      facilities: [h, a],
      unmetKWh: 0,
      contactShare: 1,
      arrayM2: 10,
      batteryKWh: 10,
      towerM: 5,
      linkKm: 1,
      failures: [],
    };
    expect(
      rankDesigns([
        { ...base, feasible: false, arrayM2: 1 },
        { ...base, feasible: true },
      ])[0].feasible,
    ).toBe(true);
  });
});
describe("analytic eclipse geometry", () => {
  it("handles no overlap, totality and annular coverage", () => {
    expect(uncoveredDisc(1, 3, 4)).toBe(1);
    expect(uncoveredDisc(1, 3, 0)).toBe(0);
    expect(uncoveredDisc(2, 1, 0)).toBeCloseTo(0.75);
  });
  it("matches equal-circle overlap and monotonic ingress/egress", () => {
    expect(uncoveredDisc(1, 1, 1)).toBeCloseTo(
      1 - ((2 * Math.PI) / 3 - Math.sqrt(3) / 2) / Math.PI,
      10,
    );
    let last = 0;
    for (let d = 0; d <= 4; d += 0.02) {
      const f = uncoveredDisc(1, 3, d);
      expect(f).toBeGreaterThanOrEqual(last - 1e-12);
      last = f;
    }
  });
});
import { radioBudget } from "./radio";
it("free-space RF loss increases 6.02 dB when distance doubles and 3.01 dB when power halves", () => {
  const a = radioBudget(10, S),
    b = radioBudget(20, S),
    c = radioBudget(10, { ...S, txPowerW: S.txPowerW / 2 });
  expect(a.marginDb - b.marginDb).toBeCloseTo(6.0206, 4);
  expect(a.marginDb - c.marginDb).toBeCloseTo(3.0103, 4);
});
it("radio budget gating cannot claim Earth access with an impossible receiver", () => {
  const r = evaluateDesign([h, a], [profile("h"), profile("a")], [link], {
    ...settings,
    rfEnabled: true,
    txPowerW: 0.000001,
    earthRxGainDbi: -50,
  });
  expect(r.contactShare).toBe(0);
});
