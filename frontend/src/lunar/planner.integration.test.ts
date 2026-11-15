// End-to-end execution of the production worker against shipped JPL/LOLA data, without a browser GPU.
import { it, expect, vi } from "vitest";
import {
  readEphem,
  readPolarTerrain,
  readCurrentGlobalDem,
  readPatch,
  readPatchIndex,
} from "../lib/testData";
import { DEFAULT_ENGINEERING } from "./engineering";
import type { PlannerRequest } from "./planner.worker";
import { writeFileSync, mkdirSync } from "node:fs";
async function execute(request: PlannerRequest) {
  let result: any;
  const target: {
    onmessage: ((e: any) => Promise<void>) | null;
    postMessage: (j: unknown) => void;
  } = {
    onmessage: null,
    postMessage: (j) => {
      if ((j as any).done || (j as any).error) result = j;
    },
  };
  vi.stubGlobal("self", target);
  vi.resetModules();
  await import("./planner.worker");
  await target.onmessage!({ data: request });
  vi.unstubAllGlobals();
  return result;
}
it("evaluates a real Connecting Ridge base, records complete provenance and returns finite physical outputs", async () => {
  const index = readPatchIndex()!,
    crest = index.patches.find((p) => p.kind === "crest20")!,
    terrain = readPolarTerrain(),
    patch = readPatch(index, crest.id),
    ephem = readEphem();
  const facilities = [
    {
      id: "hab",
      name: "Habitat",
      role: "habitat" as const,
      lat: -89.4399,
      lon: 222.8524,
      mast: 2,
      fixed: true,
    },
    {
      id: "solar",
      name: "Solar",
      role: "power" as const,
      lat: -89.4399,
      lon: 222.8524,
      mast: 2,
      areaM2: 20,
      fixed: false,
    },
  ];
  const request: PlannerRequest = {
    kind: "evaluate",
    facilities,
    source: { terrains: [patch, terrain], global: readCurrentGlobalDem() },
    ephem,
    start: Date.parse("2026-11-14T00:00:00Z"),
    settings: {
      ...DEFAULT_ENGINEERING,
      days: 2,
      requireEarth: false,
      maxSlopeDeg: 90,
    },
    radiusKm: 0.2,
    earthMaskDeg: 0,
    maxTowerM: 20,
  };
  const result = await execute(request);
  expect(result.error).toBeUndefined();
  expect(result.report.result.power.generatedKWh).toBeGreaterThan(0);
  expect(Number.isFinite(result.report.result.power.unmetKWh)).toBe(true);
  expect(result.report.profiles).toHaveLength(2);
  const r = result.report.result,
    p = r.power;
  expect(p.generatedKWh + p.initialKWh).toBeCloseTo(
    p.loadKWh -
      p.unmetKWh +
      p.finalKWh +
      p.chargeLossKWh +
      p.dischargeLossKWh +
      p.curtailedKWh,
    6,
  );
  mkdirSync("../qa/v11", { recursive: true });
  writeFileSync(
    "../qa/v11/real-base-smoke.json",
    JSON.stringify(
      {
        scenario: { ...request, source: undefined, ephem: undefined },
        result: r,
        arrayScale: result.report.arrayScale,
        profiles: result.report.profiles.map((p: any) => ({
          id: p.id,
          slope: p.slope,
          terrain: p.terrain,
          blocker: p.blocker,
        })),
        limits:
          "Integration smoke, not independent validation. Co-located components intentionally isolate electrical bookkeeping.",
      },
      null,
      2,
    ),
  );
}, 120000);
it("reproduces total solar occultation in a real ephemeris sample without asserting independent contact timing", async () => {
  const ephem = readEphem(),
    source = {
      terrains: [],
      global: { width: 8, height: 4, h: new Float32Array(32) },
    };
  const f = [
    {
      id: "h",
      name: "Habitat",
      role: "habitat" as const,
      lat: 18.562,
      lon: 61.811,
      mast: 2,
      fixed: true,
    },
    {
      id: "p",
      name: "Array",
      role: "power" as const,
      lat: 18.562,
      lon: 61.811,
      mast: 2,
      areaM2: 20,
    },
  ];
  const result = await execute({
    kind: "evaluate",
    facilities: f,
    source,
    ephem,
    start: Date.parse("2025-03-14T00:00:00Z"),
    settings: {
      ...DEFAULT_ENGINEERING,
      days: 1,
      requireEarth: false,
      maxSlopeDeg: 90,
    },
    radiusKm: 1,
    earthMaskDeg: 0,
    maxTowerM: 20,
  });
  expect(result.error).toBeUndefined();
  expect(result.report.result.eclipseEvents.length).toBeGreaterThan(0);
  expect(Math.min(...result.report.profiles[0].eclipse)).toBe(0);
  expect(result.report.result.eclipseLostGenerationKWh).toBeGreaterThan(0);
  writeFileSync(
    "../qa/v11/eclipse-smoke.json",
    JSON.stringify(
      {
        start: result.report.start,
        events: result.report.result.eclipseEvents,
        lostGenerationKWh: result.report.result.eclipseLostGenerationKWh,
        stepMinutes: 10,
        limits:
          "Actual JPL ephemeris, synthetic zero-height terrain. Not an independent event-timing validation.",
      },
      null,
      2,
    ),
  );
}, 120000);
it("runs every member of a nine-position candidate set and rechecks the shortlist", async () => {
  const ephem = readEphem(),
    source = {
      terrains: [],
      global: { width: 8, height: 4, h: new Float32Array(32) },
    };
  const f = [
    {
      id: "h",
      name: "Habitat",
      role: "habitat" as const,
      lat: 0,
      lon: 0,
      mast: 10,
      fixed: true,
    },
    {
      id: "p",
      name: "Array",
      role: "power" as const,
      lat: 0,
      lon: 0,
      mast: 10,
      areaM2: 20,
      fixed: false,
    },
  ];
  const result = await execute({
    kind: "search",
    facilities: f,
    source,
    ephem,
    start: Date.parse("2026-11-14T00:00:00Z"),
    settings: {
      ...DEFAULT_ENGINEERING,
      days: 1,
      requireEarth: false,
      maxSlopeDeg: 90,
    },
    radiusKm: 0.1,
    earthMaskDeg: 0,
    maxTowerM: 20,
  });
  expect(result.error).toBeUndefined();
  expect(result.tested).toBe(9);
  expect(result.alternatives).toHaveLength(3);
  expect(
    result.alternatives.every((r: any) => Number.isFinite(r.unmetKWh)),
  ).toBe(true);
}, 120000);
it("finds a minimum tested relay height on a curvature-limited synthetic corridor", async () => {
  const count = 49,
    data = new Float32Array(count * 8);
  for (let i = 0; i < count; i++)
    data.set([Math.sqrt(0.75), 0.5, 0, 149597870.7, 1, 0, 0, 384400], i * 8);
  const ephem = {
    t0Ms: Date.parse("2026-11-14T00:00:00Z"),
    stepS: 3600,
    count,
    data,
    kernels: ["synthetic analytic fixture"],
  };
  const source = {
    terrains: [],
    global: { width: 8, height: 4, h: new Float32Array(32) },
  };
  const facilities = [
    {
      id: "h",
      name: "Habitat",
      role: "habitat" as const,
      lat: 0,
      lon: 0,
      mast: 2,
      fixed: true,
    },
    {
      id: "p",
      name: "Array",
      role: "power" as const,
      lat: 0,
      lon: 0,
      mast: 2,
      areaM2: 20,
      fixed: true,
    },
    {
      id: "r",
      name: "Tower",
      role: "relay" as const,
      lat: 0,
      lon: 0.2,
      mast: 2,
      fixed: false,
    },
  ];
  const result = await execute({
    kind: "height",
    facilities,
    source,
    ephem,
    start: ephem.t0Ms,
    settings: {
      ...DEFAULT_ENGINEERING,
      days: 1,
      requireEarth: false,
      maxSlopeDeg: 90,
    },
    radiusKm: 1,
    earthMaskDeg: 0,
    maxTowerM: 20,
  });
  expect(result.error).toBeUndefined();
  expect(result.alternatives[0].feasible).toBe(true);
  expect(result.alternatives[0].towerM).toBe(5);
}, 120000);
