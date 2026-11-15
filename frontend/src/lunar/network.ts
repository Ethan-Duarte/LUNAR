// Original LUNAR base-layout screening. No vehicle, plume or RF-link-budget model.
import { R_KM, sitePosKm, upVector } from "../lib/geo";
import { sourceHeight, type HeightSource } from "../lib/terrain";
export type Role = "habitat" | "power" | "resource" | "relay" | "landing";
export interface Facility {
  id: string;
  name: string;
  role: Role;
  lat: number;
  lon: number;
  mast: number;
}
export function distanceKm(
  a: Pick<Facility, "lat" | "lon">,
  b: Pick<Facility, "lat" | "lon">,
) {
  const u = upVector(a.lat, a.lon),
    v = upVector(b.lat, b.lon);
  return (
    R_KM *
    Math.atan2(
      Math.hypot(
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ),
      u[0] * v[0] + u[1] * v[1] + u[2] * v[2],
    )
  );
}
export function layoutGeometry(
  f: Facility[],
  maxLinkKm: number,
  exclusionKm: number,
) {
  const edges = f
    .flatMap((a, i) =>
      f.slice(i + 1).map((b) => ({ a: a.id, b: b.id, km: distanceKm(a, b) })),
    )
    .sort((a, b) => a.km - b.km);
  const parent = new Map(f.map((x) => [x.id, x.id]));
  const find = (x: string): string => {
    let p = parent.get(x)!;
    while (p !== parent.get(p)) p = parent.get(p)!;
    return p;
  };
  const tree: typeof edges = [];
  for (const e of edges) {
    const a = find(e.a),
      b = find(e.b);
    if (a !== b) {
      parent.set(a, b);
      tree.push(e);
    }
  }
  const conflicts = edges.filter((e) => {
    const a = f.find((x) => x.id === e.a)!,
      b = f.find((x) => x.id === e.b)!;
    return (
      ((a.role === "landing" && b.role === "habitat") ||
        (b.role === "landing" && a.role === "habitat")) &&
      e.km < exclusionKm
    );
  });
  return {
    edges,
    tree,
    totalKm: tree.reduce((n, e) => n + e.km, 0),
    maxSpanKm: edges.at(-1)?.km ?? 0,
    connected: f.length > 0 && tree.every((e) => e.km <= maxLinkKm),
    conflicts,
  };
}
export function lineOfSight(a: Facility, b: Facility, source: HeightSource) {
  const pos = (f: Facility) => {
    const u = upVector(f.lat, f.lon),
      h = sourceHeight(source, ...u);
    return Number.isFinite(h) ? sitePosKm(f.lat, f.lon, h + f.mast) : null;
  };
  const p = pos(a),
    q = pos(b);
  if (!p || !q)
    return { status: "unknown" as const, minClearanceM: null, samples: 0 };
  const length = Math.hypot(...p.map((v, i) => q[i] - v));
  const steps = Math.min(10000, Math.max(2, Math.ceil(length / 0.02)));
  let min = Infinity;
  for (let i = 1; i < steps; i++) {
    const t = i / steps,
      v = p.map((x, k) => x + (q[k] - x) * t),
      r = Math.hypot(...v),
      h = sourceHeight(source, v[0] / r, v[1] / r, v[2] / r);
    if (!Number.isFinite(h))
      return { status: "unknown" as const, minClearanceM: null, samples: i };
    min = Math.min(min, (r - R_KM) * 1000 - h);
  }
  return {
    status: min < 0 ? ("blocked" as const) : ("clear" as const),
    minClearanceM: min,
    samples: steps - 1,
  };
}
export function simultaneous(flags: boolean[][]) {
  if (!flags.length || !flags[0].length) return null;
  const n = flags[0].length;
  if (flags.some((f) => f.length !== n))
    throw Error("Availability arrays must share sample times");
  let both = 0;
  for (let i = 0; i < n; i++) if (flags.every((a) => a[i])) both++;
  return both / n;
}
