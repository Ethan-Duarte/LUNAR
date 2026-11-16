/// <reference lib="webworker" />
import {dsnCovers,stationAccess,type DsnTable} from "./dsn";
import { computeHorizon } from "../lib/horizon";
import { skyAt, ephemEndMs, type Ephem } from "../lib/ephem";
import { upVector, localFrame, R_KM } from "../lib/geo";
import { sourceHeight, slopeAt, type HeightSource } from "../lib/terrain";
import { computeSeries } from "../lib/windows";
import { type Facility } from "./network";
import {
  assessLinks,
  evaluateDesign,
  recommendArrayScale,
  rankDesigns,
  validateSettings,
  type EngineeringSettings,
  type FacilityProfile,
  type RankedDesign,
} from "./engineering";
export interface PlannerRequest {
  kind: "evaluate" | "search" | "height" | "robustness";
  facilities: Facility[];
  source: HeightSource;
  ephem: Ephem;
  dsn?:DsnTable;
  start: number;
  settings: EngineeringSettings;
  radiusKm: number;
  earthMaskDeg: number;
  maxTowerM: number;
}
const yieldTask = () => new Promise<void>((r) => setTimeout(r, 0));
self.onmessage = async (e: MessageEvent<PlannerRequest>) => {
  try {
    const q = e.data,
      s = q.settings;
    validateSettings(s);
    if (
      !q.facilities.length ||
      q.facilities.length > 8 ||
      q.facilities.some(
        (f) =>
          !f.id ||
          !["habitat", "power", "resource", "relay", "landing"].includes(
            f.role,
          ) ||
          !Number.isFinite(
            f.lat + f.lon + f.mast + (f.areaM2 ?? 0) + (f.loadKW ?? 0),
          ) ||
          Math.abs(f.lat) > 90 ||
          f.mast < 0 ||
          f.mast > 100 ||
          (f.areaM2 ?? 0) < 0 ||
          (f.loadKW ?? 0) < 0,
      )
    )
      throw Error("Invalid facilities");
    if (
      !Number.isFinite(q.start) ||
      q.start < q.ephem.t0Ms ||
      q.start + s.days * 864e5 > ephemEndMs(q.ephem)
    )
      throw Error("Study lies outside the supplied ephemeris dates");
    if (
      !Number.isFinite(q.radiusKm) ||
      q.radiusKm <= 0 ||
      q.radiusKm > 10 ||
      !Number.isFinite(q.maxTowerM) ||
      q.maxTowerM < 2 ||
      q.maxTowerM > 100
    )
      throw Error("Search radius must be 0–10 km and tower limit 2–100 m");
    const dsnAvailable=q.dsn&&dsnCovers(q.dsn,q.start,q.start+s.days*864e5);
    if(s.requireDsn&&!dsnAvailable)throw Error('DSN geometry covers 2026-11-01 through 2027-01-01 UTC only. Choose a covered study or disable the DSN requirement.');
    const cache = new Map<string, FacilityProfile>();
    function profile(f: Facility, azStep = 0.5) {
      const key = [f.lat, f.lon, f.mast, azStep].join(":");
      const old = cache.get(key);
      if (old) return { ...old, id: f.id };
      const u = upVector(f.lat, f.lon),
        ground = sourceHeight(q.source, ...u);
      if (!Number.isFinite(ground))
        throw Error("Terrain is missing at " + f.name);
      const h = computeHorizon(q.source, f.lat, f.lon, {
        observerHeightM: f.mast,
        azStepDeg: azStep,
        maxRangeKm: 300,
      });
      const series = computeSeries(
        q.ephem,
        h,
        ground,
        q.start,
        q.start + s.days * 864e5 - s.stepMinutes * 60000,
        s.stepMinutes * 60000,
      );
      let slope: number | null = null,
        terrain = "Global elevation grid";
      for (const t of q.source.terrains) {
        const v = slopeAt(t, f.lat, f.lon);
        if (Number.isFinite(v)) {
          slope = v;
          terrain = t.id ?? "Polar LOLA";
          break;
        }
      }
      if (slope === null && q.source.global) {
        const frame = localFrame(f.lat, f.lon),
          delta =
            (((R_KM * 1000 * Math.PI) / 180) * 360) / q.source.global.width;
        const sample = (dir: number[], sign: number) => {
          const a = delta / (R_KM * 1000),
            d = u.map((v, i) => v * Math.cos(a) + sign * dir[i] * Math.sin(a));
          return sourceHeight(q.source, d[0], d[1], d[2]);
        };
        const n = (sample(frame.n, 1) - sample(frame.n, -1)) / (2 * delta),
          east = (sample(frame.e, 1) - sample(frame.e, -1)) / (2 * delta);
        if (Number.isFinite(n + east))
          slope = (Math.atan(Math.hypot(n, east)) * 180) / Math.PI;
      }
      const costs = new Float64Array(h.elevDeg.length),
        sunDistanceAU: number[] = [],
        earthDistanceKm: number[] = [];
      for (let i = 0; i < series.count; i++) {
        const sky = skyAt(
          q.ephem,
          q.start + i * s.stepMinutes * 60000,
          f.lat,
          f.lon,
          ground + f.mast,
        );
        sunDistanceAU.push(sky.sun.distKm / 149597870.7);
        earthDistanceKm.push(sky.earth.distKm);
        if (sky.sun.el + sky.sun.radius > 0)
          costs[Math.round(sky.sun.az / azStep) % costs.length] +=
            ((1 - series.terrainSunFrac![i]) * s.stepMinutes) / 60;
      }
      let worst = 0;
      for (let i = 1; i < costs.length; i++)
        if (costs[i] > costs[worst]) worst = i;
      const p: FacilityProfile = {
        id: f.id,
        sun: Array.from(series.sunFrac),
        terrainSun: Array.from(series.terrainSunFrac!),
        eclipse: Array.from(series.eclipseVisible!),
        earth: Array.from(series.earthClear, (v) => v >= q.earthMaskDeg),
        dsn:dsnAvailable?Array.from({length:series.count},(_,i)=>stationAccess(q.dsn!,q.start+i*s.stepMinutes*60000,f.lat,f.lon,ground+f.mast,h,q.earthMaskDeg)!.some(Boolean)):undefined,
        sunEl: Array.from(series.sunEl),
        sunDistanceAU,
        earthDistanceKm,
        slope,
        terrain,
        blocker: {
          az: worst * azStep,
          alt: h.elevDeg[worst],
          distanceKm: h.distKm[worst],
          lossHours: costs[worst],
        },
      };
      cache.set(key, p);
      return p;
    }
    function assess(f: Facility[], az = 0.5, sizing = true) {
      const profiles = f.map((x) => profile(x, az)),
        links = assessLinks(f, q.source, s),
        result = evaluateDesign(f, profiles, links, s, sizing);
      return { profiles, links, result };
    }
    if (q.kind === "evaluate") {
      self.postMessage({
        progress: "Tracing measured horizons and eclipse-aware power…",
      });
      const a = assess(q.facilities);
      const arrayScale = recommendArrayScale(
        q.facilities,
        a.profiles,
        a.links,
        s,
      );
      self.postMessage({
        done: true,
        report: {
          schema: "lunar-engineering-1",
          model: "1.7-preview",
          dsn:q.dsn?{start:q.dsn.start,end:q.dsn.start+(q.dsn.count-1)*q.dsn.stepMs,stations:q.dsn.stations,stepMs:q.dsn.stepMs}:null,
          start: q.start,
          settings: s,
          criteria: { earthMaskDeg: q.earthMaskDeg },
          facilities: q.facilities,
          ...a,
          arrayScale,
          azimuthStepDeg: 0.5,
          horizonRadiusKm: 300,
          provenance: {
            ephemeris: {
              start: q.ephem.t0Ms,
              stepSeconds: q.ephem.stepS,
              kernels: q.ephem.kernels,
            },
            terrain: q.source.terrains.map((t) => ({
              id: t.id ?? "polar",
              radiusM: t.radiusM,
              levels: t.levels.map((l) => ({ pixelM: l.pixel, size: l.size })),
            })),
            global: q.source.global
              ? { width: q.source.global.width, height: q.source.global.height }
              : null,
          },
        },
      });
      return;
    }
    const anchor =
        q.facilities.find((f) => f.role === "habitat") ?? q.facilities[0],
      movable = q.facilities.filter((f) => !f.fixed);
    if (q.kind === "search" && (!movable.length || movable.length > 3))
      throw Error(
        "Select one to three movable components; keep habitat/resource anchors fixed",
      );
    const destination = (northKm: number, eastKm: number) => {
      const frame = localFrame(anchor.lat, anchor.lon),
        r = Math.hypot(northKm, eastKm),
        ang = r / R_KM;
      const v = frame.u.map(
        (x, i) =>
          x * Math.cos(ang) +
          (r ? (northKm * frame.n[i] + eastKm * frame.e[i]) / r : 0) *
            Math.sin(ang),
      );
      return {
        lat: (Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI,
        lon: (Math.atan2(v[1], v[0]) * 180) / Math.PI,
      };
    };
    const coords = [
      { lat: anchor.lat, lon: anchor.lon },
      ...Array.from({ length: 8 }, (_, i) =>
        destination(
          q.radiusKm * Math.cos((i * Math.PI) / 4),
          q.radiusKm * Math.sin((i * Math.PI) / 4),
        ),
      ),
    ];
    let variants: Facility[][] = [];
    if (q.kind === "robustness") {
      variants = [
        q.facilities,
        ...Array.from({ length: 8 }, (_, i) =>
          q.facilities.map((f) => {
            const frame = localFrame(f.lat, f.lon),
              ang = s.footprintM / (R_KM * 1000),
              u = frame.u.map(
                (v, k) =>
                  v * Math.cos(ang) +
                  (frame.n[k] * Math.cos((i * Math.PI) / 4) +
                    frame.e[k] * Math.sin((i * Math.PI) / 4)) *
                    Math.sin(ang),
              );
            return {
              ...f,
              lat: (Math.asin(u[2]) * 180) / Math.PI,
              lon: (Math.atan2(u[1], u[0]) * 180) / Math.PI,
            };
          }),
        ),
      ];
    } else if (q.kind === "height") {
      const relays = q.facilities.filter((f) => f.role === "relay" && !f.fixed);
      if (relays.length !== 1)
        throw Error(
          "Make exactly one relay movable for the tower-height sweep",
        );
      const hs = [
        ...new Set(
          [2, 5, 10, 20, 30, 50, q.maxTowerM].filter((h) => h <= q.maxTowerM),
        ),
      ].sort((a, b) => a - b);
      variants = hs.map((height) =>
        q.facilities.map((f) =>
          f.id === relays[0].id ? { ...f, mast: height } : f,
        ),
      );
    } else {
      const count = 9 ** movable.length,
        indices = Array.from({ length: Math.min(count, 243) }, (_, i) =>
          Math.floor((i * count) / Math.min(count, 243)),
        );
      variants = indices.map((index) => {
        let v = index;
        const placed = new Map<string, ReturnType<typeof destination>>();
        for (const f of movable) {
          placed.set(f.id, coords[v % 9]);
          v = Math.floor(v / 9);
        }
        return q.facilities.map((f) =>
          placed.has(f.id) ? { ...f, ...placed.get(f.id)! } : f,
        );
      });
    }
    const rows: RankedDesign[] = [];
    for (let i = 0; i < variants.length; i++) {
      if (i % 2 === 0) {
        self.postMessage({
          progress: `Screening ${i + 1}/${variants.length} layouts; ${q.kind === "search" ? "2" : ".5"}° horizons, ${s.stepMinutes} min power samples`,
        });
        await yieldTask();
      }
      const f = variants[i],
        a = assess(f, q.kind === "search" ? 2 : 0.5, false),
        r = a.result;
      rows.push({
        facilities: f,
        feasible: r.feasible,
        unmetKWh: r.power.unmetKWh,
        contactShare: r.contactShare,
        arrayM2: r.totalArrayM2,
        batteryKWh: null,
        towerM: Math.max(
          0,
          ...f.filter((x) => x.role === "relay").map((x) => x.mast),
        ),
        linkKm: r.totalLinkKm,
        failures: r.failures,
      });
    }
    if (q.kind === "robustness") {
      self.postMessage({
        done: true,
        alternatives: rows,
        tested: rows.length,
        kind: q.kind,
        note: `Centre plus eight common placement offsets of ${s.footprintM} m, .5° horizons. This is sensitivity sampling, not a probability or DEM error bound.`,
      });
      return;
    }
    // Re-evaluate the shortlist at the normal .5° horizon; never carry a coarse pass forward as a final pass.
    const shortlist = (
      q.kind === "height"
        ? [...rows].sort(
            (a, b) =>
              Number(b.feasible) - Number(a.feasible) || a.towerM - b.towerM,
          )
        : rankDesigns(rows)
    )
      .slice(0, 3)
      .map((row) => {
        const checked = assess(row.facilities, 0.5, false),
          scale = recommendArrayScale(
            row.facilities,
            checked.profiles,
            checked.links,
            s,
          );
        const facilities =
          scale === null
            ? row.facilities
            : row.facilities.map((f) =>
                f.role === "power"
                  ? {
                      ...f,
                      areaM2: Math.ceil((f.areaM2 ?? 0) * scale * 10) / 10,
                    }
                  : f,
              );
        const r = assess(facilities).result;
        return {
          ...row,
          facilities,
          arrayM2: r.totalArrayM2,
          feasible: r.feasible,
          unmetKWh: r.power.unmetKWh,
          contactShare: r.contactShare,
          batteryKWh: r.requiredBatteryKWh,
          failures: r.failures,
        };
      });
    self.postMessage({
      done: true,
      alternatives:
        q.kind === "height"
          ? shortlist.sort(
              (a, b) =>
                Number(b.feasible) - Number(a.feasible) || a.towerM - b.towerM,
            )
          : rankDesigns(shortlist),
      tested: variants.length,
      kind: q.kind,
      region: { anchor, radiusKm: q.radiusKm },
      note: "Nine candidate positions: anchor and eight boundary points. Up to 243 deterministic combinations; top three rechecked at .5°. Heights sampled discretely. No global-optimum claim; array proportions resized on the shortlist for the current battery capacity. Search-stage array sizes remain fixed.",
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
