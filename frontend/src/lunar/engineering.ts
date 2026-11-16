// Original LUNAR preliminary engineering model. Explicit ideal shared electrical bus; not flight design.
import { radioBudget, type RadioAssumptions } from "./radio";
import { distanceKm, lineOfSight, type Facility } from "./network";
import type { HeightSource } from "../lib/terrain";
export interface EngineeringSettings extends RadioAssumptions {
  rfEnabled: boolean;
  requireDsn?: boolean;
  footprintM: number;
  days: number;
  stepMinutes: number;
  loadKW: number;
  efficiency: number;
  derate: number;
  batteryKWh: number;
  initialSoc: number;
  chargeEfficiency: number;
  dischargeEfficiency: number;
  reserveSoc: number;
  maxLinkKm: number;
  exclusionKm: number;
  cableLossPerKm: number;
  requireEarth: boolean;
  maxOutageHours: number;
  maxSlopeDeg: number;
  panelMode: "tracking" | "horizontal";
  solarFlux: number;
}
export const DEFAULT_ENGINEERING: EngineeringSettings = {
  rfEnabled: false,
  requireDsn:false,
  footprintM: 100,
  frequencyGHz: 2.2,
  txPowerW: 5,
  txGainDbi: 20,
  rxGainDbi: 20,
  earthRxGainDbi: 55,
  noiseK: 300,
  rateKbps: 100,
  requiredEbN0Db: 10,
  implementationLossDb: 3,
  days: 14,
  stepMinutes: 10,
  loadKW: 1,
  efficiency: 0.25,
  derate: 0.8,
  batteryKWh: 100,
  initialSoc: 1,
  chargeEfficiency: 0.95,
  dischargeEfficiency: 0.95,
  reserveSoc: 0.2,
  maxLinkKm: 10,
  exclusionKm: 2,
  cableLossPerKm: 0.005,
  requireEarth: true,
  maxOutageHours: 24,
  maxSlopeDeg: 15,
  panelMode: "tracking",
  solarFlux: 1361,
};
export interface PowerRun {
  socKWh: number[];
  unmetKW: number[];
  generatedKWh: number;
  loadKWh: number;
  unmetKWh: number;
  curtailedKWh: number;
  chargeLossKWh: number;
  dischargeLossKWh: number;
  initialKWh: number;
  finalKWh: number;
  minSoc: number;
  longestShortfallHours: number;
}
export function validateSettings(s: EngineeringSettings) {
  const finite = Object.values(s).filter(
    (v) => typeof v === "number",
  ) as number[];
  if (
    finite.some((v) => !Number.isFinite(v)) ||
    s.days < 1 ||
    s.days > 60 ||
    ![5, 10, 20, 60].includes(s.stepMinutes) ||
    s.loadKW < 0 ||
    s.batteryKWh < 0 ||
    s.maxLinkKm <= 0 ||
    s.exclusionKm < 0 ||
    s.maxOutageHours < 0 ||
    s.maxSlopeDeg < 0 ||
    s.maxSlopeDeg > 90 ||
    s.solarFlux <= 0 ||
    s.cableLossPerKm < 0 ||
    s.cableLossPerKm > 0.1 ||
    ![s.efficiency, s.derate, s.chargeEfficiency, s.dischargeEfficiency].every(
      (v) => v > 0 && v <= 1,
    ) ||
    ![s.initialSoc, s.reserveSoc].every((v) => v >= 0 && v <= 1) ||
    !["tracking", "horizontal"].includes(s.panelMode) ||
    typeof s.requireEarth !== "boolean" ||
    typeof s.rfEnabled !== "boolean" ||
    s.footprintM < 0 ||
    s.footprintM > 500 ||
    s.frequencyGHz <= 0 ||
    s.txPowerW <= 0 ||
    s.noiseK <= 0 ||
    s.rateKbps <= 0 ||
    s.implementationLossDb < 0
  )
    throw Error("Invalid engineering assumptions");
}
export function simulatePower(
  generationKW: number[],
  loadKW: number,
  stepHours: number,
  s: Pick<
    EngineeringSettings,
    "batteryKWh" | "initialSoc" | "chargeEfficiency" | "dischargeEfficiency"
  >,
): PowerRun {
  if (
    !Number.isFinite(
      loadKW +
        stepHours +
        s.batteryKWh +
        s.initialSoc +
        s.chargeEfficiency +
        s.dischargeEfficiency,
    ) ||
    loadKW < 0 ||
    stepHours <= 0 ||
    s.batteryKWh < 0 ||
    s.initialSoc < 0 ||
    s.initialSoc > 1 ||
    s.chargeEfficiency <= 0 ||
    s.chargeEfficiency > 1 ||
    s.dischargeEfficiency <= 0 ||
    s.dischargeEfficiency > 1 ||
    generationKW.some((v) => !Number.isFinite(v) || v < 0)
  )
    throw Error("Invalid electrical inputs");
  let energy = s.batteryKWh * s.initialSoc,
    min = energy,
    unmetKWh = 0,
    curtailedKWh = 0,
    chargeLossKWh = 0,
    dischargeLossKWh = 0,
    run = 0,
    longest = 0;
  const initialKWh = energy,
    socKWh = [energy],
    unmetKW: number[] = [];
  for (const g of generationKW) {
    const net = (g - loadKW) * stepHours;
    if (net >= 0) {
      const accepted = Math.min(
        net,
        (s.batteryKWh - energy) / s.chargeEfficiency,
      );
      energy += accepted * s.chargeEfficiency;
      chargeLossKWh += accepted * (1 - s.chargeEfficiency);
      curtailedKWh += net - accepted;
      unmetKW.push(0);
      run = 0;
    } else {
      const delivered = Math.min(-net, energy * s.dischargeEfficiency);
      energy -= delivered / s.dischargeEfficiency;
      dischargeLossKWh += delivered / s.dischargeEfficiency - delivered;
      const gap = -net - delivered;
      unmetKWh += gap;
      unmetKW.push(gap / stepHours);
      run = gap > 1e-8 ? run + stepHours : 0;
      longest = Math.max(longest, run);
    }
    energy = Math.max(0, Math.min(s.batteryKWh, energy));
    min = Math.min(min, energy);
    socKWh.push(energy);
  }
  return {
    socKWh,
    unmetKW,
    initialKWh,
    finalKWh: energy,
    minSoc: s.batteryKWh ? min / s.batteryKWh : unmetKWh > 1e-8 ? 0 : 1,
    generatedKWh: generationKW.reduce((a, b) => a + b, 0) * stepHours,
    loadKWh: loadKW * generationKW.length * stepHours,
    unmetKWh,
    curtailedKWh,
    chargeLossKWh,
    dischargeLossKWh,
    longestShortfallHours: longest,
  };
}
export function minimumBattery(
  generation: number[],
  load: number,
  dt: number,
  s: EngineeringSettings,
): number | null {
  const works = (capacity: number) => {
    const r = simulatePower(generation, load, dt, {
      ...s,
      batteryKWh: capacity,
    });
    return r.unmetKWh < 1e-7 && r.minSoc >= s.reserveSoc - 1e-8;
  };
  if (works(0)) return 0;
  let hi = 1;
  while (hi < 1e7 && !works(hi)) hi *= 2;
  if (!works(hi)) return null;
  let lo = 0;
  for (let k = 0; k < 36; k++) {
    const m = (lo + hi) / 2;
    if (works(m)) hi = m;
    else lo = m;
  }
  return hi;
}
export interface FacilityProfile {
  id: string;
  sun: number[];
  terrainSun: number[];
  eclipse: number[];
  earth: boolean[];
  dsn?: boolean[];
  sunEl: number[];
  sunDistanceAU?: number[];
  earthDistanceKm?: number[];
  slope: number | null;
  terrain: string;
  blocker?: { az: number; alt: number; distanceKm: number; lossHours: number };
}
export function panelGeneration(
  f: Facility,
  p: FacilityProfile,
  s: EngineeringSettings,
  lossDistanceKm = 0,
  ignoreEclipse = false,
) {
  const area = f.areaM2 ?? 0;
  if (!Number.isFinite(area) || area < 0) throw Error("Invalid array area");
  return p.sun.map(
    (v, i) =>
      ((((area * s.solarFlux) / 1000) *
        s.efficiency *
        s.derate *
        (ignoreEclipse ? p.terrainSun[i] : v) *
        (s.panelMode === "horizontal"
          ? Math.max(0, Math.sin((p.sunEl[i] * Math.PI) / 180))
          : 1)) /
        (p.sunDistanceAU?.[i] ?? 1) ** 2) *
      Math.max(0, 1 - s.cableLossPerKm * lossDistanceKm),
  );
}
export interface Link {
  a: string;
  b: string;
  km: number;
  status: "clear" | "blocked" | "unknown";
  minClearanceM: number | null;
  rfMarginDb?: number;
}
export function assessLinks(
  f: Facility[],
  source: HeightSource,
  s: EngineeringSettings,
): Link[] {
  return f.flatMap((a, i) =>
    f
      .slice(i + 1)
      .map((b) => ({
        a: a.id,
        b: b.id,
        km: distanceKm(a, b),
        rfMarginDb: radioBudget(distanceKm(a, b), s).marginDb,
        ...lineOfSight(a, b, source),
      })),
  );
}
export function reachable(
  start: string,
  links: Link[],
  maxKm: number,
  allowed?: Set<string>,
) {
  const seen = new Set([start]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of links) {
      if (
        e.status !== "clear" ||
        e.km > maxKm ||
        (allowed && (!allowed.has(e.a) || !allowed.has(e.b)))
      )
        continue;
      if (seen.has(e.a) && !seen.has(e.b)) {
        seen.add(e.b);
        changed = true;
      }
      if (seen.has(e.b) && !seen.has(e.a)) {
        seen.add(e.a);
        changed = true;
      }
    }
  }
  return seen;
}
function longestFalse(flags: boolean[], dt: number) {
  let r = 0,
    b = 0;
  for (const f of flags) {
    r = f ? 0 : r + dt;
    b = Math.max(b, r);
  }
  return b;
}
export function evaluateDesign(
  f: Facility[],
  p: FacilityProfile[],
  links: Link[],
  s: EngineeringSettings,
  sizing = true,
) {
  validateSettings(s);
  const habitats = f.filter((x) => x.role === "habitat"),
    arrays = f.filter((x) => x.role === "power"),
    by = new Map(p.map((x) => [x.id, x])),
    n = p[0]?.sun.length ?? 0,
    dt = s.stepMinutes / 60;
  if (
    !n ||
    p.length !== f.length ||
    p.some(
      (x) =>
        x.sun.length !== n ||
        x.earth.length !== n ||
        x.terrainSun.length !== n ||
        x.eclipse.length !== n ||
        x.sunEl.length !== n,
    )
  )
    throw Error("Profiles must share sample times");
  const electrical = f.filter(
      (x) => x.role === "habitat" || x.role === "power" || x.role === "relay",
    ),
    electricSet = new Set(electrical.map((x) => x.id)),
    electricLinks = links.filter(
      (e) => electricSet.has(e.a) && electricSet.has(e.b),
    ),
    reach = habitats[0]
      ? reachable(habitats[0].id, electricLinks, s.maxLinkKm)
      : new Set<string>();
  const disconnectedIds=electrical.filter(x=>!reach.has(x.id)).map(x=>x.id);
  const electricalConnected =
    habitats.length > 0 &&
    arrays.length > 0 &&
    electrical.every((x) => reach.has(x.id));
  const load = s.loadKW + f.reduce((a, x) => a + (x.loadKW ?? 0), 0),
    generation = new Array(n).fill(0),
    withoutEclipse = new Array(n).fill(0);
  // Conservative preliminary bus: the electrical set must all have clear straight corridors.
  // Cable loss uses shortest path distance along those corridors, not an arbitrary nearest hub.
  const distances = new Map<string, number>(
    habitats[0] ? [[habitats[0].id, 0]] : [],
  );
  for (let k = 0; k < f.length; k++)
    for (const e of electricLinks)
      if (e.status === "clear" && e.km <= s.maxLinkKm) {
        const da = distances.get(e.a) ?? Infinity,
          db = distances.get(e.b) ?? Infinity;
        if (da + e.km < db) distances.set(e.b, da + e.km);
        if (db + e.km < da) distances.set(e.a, db + e.km);
      }
  for (const a of arrays) {
    const profile = by.get(a.id)!;
    const g = panelGeneration(a, profile, s, distances.get(a.id) ?? 0),
      g0 = panelGeneration(a, profile, s, distances.get(a.id) ?? 0, true);
    for (let i = 0; i < n; i++) {
      if (electricalConnected) {
        generation[i] += g[i];
        withoutEclipse[i] += g0[i];
      }
    }
  }
  const power = simulatePower(generation, load, dt, s),
    noEclipse = simulatePower(withoutEclipse, load, dt, s),
    requiredBatteryKWh = sizing
      ? minimumBattery(generation, load, dt, s)
      : null;
  const radioSet = new Set(
      f
        .filter((x) => x.role === "habitat" || x.role === "relay")
        .map((x) => x.id),
    ),
    radioReach = habitats.map((h) =>
      reachable(
        h.id,
        s.rfEnabled
          ? links.filter((e) => (e.rfMarginDb ?? -Infinity) >= 0)
          : links,
        s.maxLinkKm,
        radioSet,
      ),
    );
  const contact = Array.from(
      { length: n },
      (_, i) =>
        habitats.length > 0 &&
        radioReach.every((group) =>
          [...group].some(
            (id) =>
              by.get(id)?.earth[i] &&
              (!s.rfEnabled ||
                radioBudget(by.get(id)?.earthDistanceKm?.[i] ?? 384400, s, true)
                  .marginDb >= 0),
          ),
        ),
    ),
    longestContactLossHours = longestFalse(contact, dt);
  const dsnKnown=habitats.length>0&&[...new Set(radioReach.flatMap(g=>[...g]))].every(id=>by.get(id)?.dsn?.length===n);
  const dsnContact=dsnKnown?Array.from({length:n},(_,i)=>radioReach.every(group=>[...group].some(id=>by.get(id)?.dsn?.[i]&&(!s.rfEnabled||radioBudget(by.get(id)?.earthDistanceKm?.[i]??384400,s,true).marginDb>=0)))):undefined;
  const longestDsnLossHours=dsnContact?longestFalse(dsnContact,dt):null;
  const conflicts = f
    .filter((x) => x.role === "landing")
    .flatMap((a) =>
      habitats
        .filter((b) => distanceKm(a, b) < s.exclusionKm)
        .map((b) => `${a.name} is inside ${b.name}'s pad exclusion`),
    );
  const failures: string[] = [];
  if(s.requireDsn&&!dsnKnown)failures.push('Station-specific DSN geometry unavailable for this study; no DSN pass can be established');
  if(s.requireDsn&&longestDsnLossHours!==null&&longestDsnLossHours>s.maxOutageHours+1e-8)failures.push(`DSN outage ${longestDsnLossHours.toFixed(2)} h exceeds ${s.maxOutageHours.toFixed(2)} h limit`);
  if (!habitats.length) failures.push("Add a habitat anchor");
  if (!arrays.length) failures.push("Add a solar array");
  if (!electricalConnected)
    failures.push("Electrical facilities need connected, clear straight corridors within the link limit. Disconnected: "+electrical.filter(x=>disconnectedIds.includes(x.id)).map(x=>x.name).join(', '));
  if (power.unmetKWh > 1e-6)
    failures.push(`${power.unmetKWh.toFixed(2)} kWh unmet demand`);
  if (power.minSoc < s.reserveSoc - 1e-6)
    failures.push("Battery drops below the required reserve");
  if (s.requireEarth && longestContactLossHours > s.maxOutageHours + 1e-8)
    failures.push(`Earth-contact outage exceeds ${s.maxOutageHours} h`);
  for (const q of p)
    if (q.slope === null)
      failures.push(
        `Terrain slope unknown at ${f.find((x) => x.id === q.id)?.name}`,
      );
    else if (q.slope > s.maxSlopeDeg)
      failures.push(
        `Slope limit exceeded at ${f.find((x) => x.id === q.id)?.name}`,
      );
  failures.push(...conflicts);
  const eclipseEvents: {
    startIndex: number;
    endIndex: number;
    minVisible: number;
  }[] = [];
  for (let i = 0; i < n; i++)
    if (p.some((q) => q.eclipse[i] < 0.999999)) {
      const start = i;
      let min = 1;
      while (i < n && p.some((q) => q.eclipse[i] < 0.999999)) {
        min = Math.min(min, ...p.map((q) => q.eclipse[i]));
        i++;
      }
      eclipseEvents.push({ startIndex: start, endIndex: i, minVisible: min });
    }
  return {
    feasible: failures.length === 0,
    failures,
    electricalConnected,
    disconnectedIds,
    power,
    requiredBatteryKWh,
    withoutEclipseMinimumBatteryKWh: sizing
      ? minimumBattery(withoutEclipse, load, dt, s)
      : null,
    eclipseLostGenerationKWh:
      withoutEclipse.reduce((a, v, i) => a + v - generation[i], 0) * dt,
    eclipseExtraUnmetKWh: power.unmetKWh - noEclipse.unmetKWh,
    eclipseEvents,
    contact,
    dsnContact,
    longestDsnLossHours,
    dsnShare:dsnContact?dsnContact.filter(Boolean).length/n:null,
    contactShare: contact.filter(Boolean).length / n,
    longestContactLossHours,
    generation,
    loadKW: load,
    totalArrayM2: arrays.reduce((a, x) => a + (x.areaM2 ?? 0), 0),
    totalLinkKm: links
      .filter((e) => e.status === "clear" && e.km <= s.maxLinkKm)
      .reduce((a, e) => a + e.km, 0),
  };
}
export function recommendArrayScale(
  f: Facility[],
  profiles: FacilityProfile[],
  links: Link[],
  s: EngineeringSettings,
): number | null {
  if (!f.some((x) => x.role === "power" && (x.areaM2 ?? 0) > 0)) return null;
  const works = (scale: number) => {
    const r = evaluateDesign(
      f.map((x) =>
        x.role === "power" ? { ...x, areaM2: (x.areaM2 ?? 0) * scale } : x,
      ),
      profiles,
      links,
      s,
      false,
    );
    return (
      r.electricalConnected &&
      r.power.unmetKWh < 1e-6 &&
      r.power.minSoc >= s.reserveSoc - 1e-6
    );
  };
  if (works(0)) return 0;
  let hi = 1;
  while (hi < 1024 && !works(hi)) hi *= 2;
  if (!works(hi)) return null;
  let lo = 0;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (works(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
export interface RankedDesign {
  facilities: Facility[];
  feasible: boolean;
  unmetKWh: number;
  contactShare: number;
  arrayM2: number;
  batteryKWh: number | null;
  towerM: number;
  linkKm: number;
  failures: string[];
}
export function rankDesigns(rows: RankedDesign[]) {
  return [...rows].sort(
    (a, b) =>
      Number(b.feasible) - Number(a.feasible) ||
      a.unmetKWh - b.unmetKWh ||
      b.contactShare - a.contactShare ||
      a.arrayM2 - b.arrayM2 ||
      (a.batteryKWh ?? Infinity) - (b.batteryKWh ?? Infinity) ||
      a.towerM - b.towerM ||
      a.linkKm - b.linkKm,
  );
}
