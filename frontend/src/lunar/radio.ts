// Free-space screening link budget; no diffraction, fading, scheduling, pointing or weather model.
export interface RadioAssumptions {
  frequencyGHz: number;
  txPowerW: number;
  txGainDbi: number;
  rxGainDbi: number;
  earthRxGainDbi: number;
  noiseK: number;
  rateKbps: number;
  requiredEbN0Db: number;
  implementationLossDb: number;
}
export function radioBudget(
  distanceKm: number,
  s: RadioAssumptions,
  earth = false,
) {
  if (
    !Number.isFinite(distanceKm) ||
    distanceKm < 0 ||
    s.frequencyGHz <= 0 ||
    s.txPowerW <= 0 ||
    s.noiseK <= 0 ||
    s.rateKbps <= 0
  )
    throw Error("Invalid RF budget inputs");
  const fsplDb =
    20 * Math.log10(Math.max(distanceKm, 0.001)) +
    20 * Math.log10(s.frequencyGHz) +
    92.447783;
  const receivedDbw =
    10 * Math.log10(s.txPowerW) +
    s.txGainDbi +
    (earth ? s.earthRxGainDbi : s.rxGainDbi) -
    fsplDb -
    s.implementationLossDb;
  const noiseDensityDbwHz = 10 * Math.log10(1.380649e-23 * s.noiseK),
    ebN0Db =
      receivedDbw - noiseDensityDbwHz - 10 * Math.log10(s.rateKbps * 1000);
  return { fsplDb, receivedDbw, ebN0Db, marginDb: ebN0Db - s.requiredEbN0Db };
}
