// mir_eval-style scoring helpers shared by the mapper evaluation and its regression gate.
// Plain ESM: this file must stay runnable under plain Node, with no Bun APIs.
import { readdirSync } from "node:fs"

export const ONSET_WINDOW = 0.05
export const BEAT_WINDOW = 0.07

const EPS = 1e-9

// Maximum one-to-one matching of two event lists within a common window.
// For equal windows, matching each reference event to the earliest still-unused
// estimate inside its window is optimal (classic interval-to-point matching).
export const matchEvents = (ref, est, window) => {
  const a = [...ref].sort((x, y) => x - y)
  const b = [...est].sort((x, y) => x - y)
  const w = window + EPS
  let j = 0
  let pairs = 0
  for (const r of a) {
    while (j < b.length && b[j] < r - w) j++
    if (j < b.length && b[j] <= r + w) {
      pairs++
      j++
    }
  }
  return pairs
}

export const prf = (ref, est, window) => {
  if (!ref.length || !est.length) return { precision: 0, recall: 0, f: 0, tp: 0 }
  const tp = matchEvents(ref, est, window)
  const precision = tp / est.length
  const recall = tp / ref.length
  const f = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0
  return { precision, recall, f, tp }
}

const TRUTH_SUFFIX = ".truth.json"

export const discoverTruthSongs = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(TRUTH_SUFFIX))
    .map((name) => name.slice(0, -TRUTH_SUFFIX.length))
    .sort()

export const findRegressions = (scores, baseline, tolerance) => {
  const out = []
  for (const [song, metrics] of Object.entries(baseline)) {
    for (const [metric, base] of Object.entries(metrics)) {
      const now = scores?.[song]?.[metric]
      if (!Number.isFinite(now) || now < base - tolerance) out.push({ song, metric, base, now })
    }
  }
  return out
}
