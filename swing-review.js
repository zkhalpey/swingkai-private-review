// SwingKai swing-review engine. Pure, dependency-free, shared by the local server and the review PWA.
// Input: wrist/pocket/chest inertial samples. Output: timing facts and coach-style suggestions.
// Boundary: timing and rhythm from a consumer inertial sensor only. Never force, pressure, centre of pressure,
// clubface, ball data or a technique score.
export const ENGINE_VERSION = '0.2.0';
export const CONTRACT_FIELDS = ['session_id','batch_sequence','sample_sequence','monotonic_timestamp','orientation','battery_state'];
export const PLACEMENTS = {
  'lead-wrist': 'Lead wrist (watch or band)',
  'trail-wrist': 'Trail wrist (watch or band)',
  'trouser-pocket': 'Phone in trouser pocket (not a calibrated pelvis measurement)',
  'chest-pocket': 'Phone in chest pocket (not a calibrated torso measurement)',
  'unknown': 'Unknown placement'
};
const mag = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const sd = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const cv = a => { const m = mean(a); return m ? sd(a) / m : 0; };
const r2 = v => Math.round(v * 100) / 100;

/** Normalise raw samples to {t (s), w (rad/s magnitude), a (g magnitude)} sorted by time. */
export function normalise(samples) {
  const out = [];
  for (const s of samples || []) {
    const t = Number(s.t ?? s.monotonic_timestamp ?? s.timestamp);
    if (!Number.isFinite(t)) continue;
    const gx = Number(s.gx ?? s.rotation_x ?? 0), gy = Number(s.gy ?? s.rotation_y ?? 0), gz = Number(s.gz ?? s.rotation_z ?? 0);
    const ax = Number(s.ax ?? s.accel_x ?? 0), ay = Number(s.ay ?? s.accel_y ?? 0), az = Number(s.az ?? s.accel_z ?? 0);
    out.push({ t, w: mag(gx, gy, gz), a: mag(ax, ay, az) });
  }
  out.sort((p, q) => p.t - q.t);
  return out;
}

function smooth(values, k) {
  const out = new Array(values.length).fill(0);
  for (let i = 0; i < values.length; i++) { let s = 0, n = 0; for (let j = Math.max(0, i - k); j <= Math.min(values.length - 1, i + k); j++) { s += values[j]; n++; } out[i] = s / n; }
  return out;
}

/** Detect swings from the rotation-rate envelope. Returns per-swing timing. */
export function detectSwings(norm, opts = {}) {
  if (norm.length < 20) return { swings: [], sample_hz: 0 };
  const dur = norm[norm.length - 1].t - norm[0].t;
  const hz = dur > 0 ? (norm.length - 1) / dur : 0;
  const k = Math.max(1, Math.round(hz * 0.04));
  const w = smooth(norm.map(s => s.w), k);
  const globalMax = Math.max(...w);
  const floor = opts.min_peak_rad_s ?? 1.5;             // below this nothing counts as a swing
  const thr = Math.max(floor, globalMax * 0.45);
  const refractory = opts.refractory_s ?? 1.5;
  const peaks = [];
  for (let i = 1; i < w.length - 1; i++) {
    if (w[i] >= thr && w[i] >= w[i - 1] && w[i] >= w[i + 1]) {
      if (peaks.length && norm[i].t - norm[peaks[peaks.length - 1]].t < refractory) { if (w[i] > w[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = i; }
      else peaks.push(i);
    }
  }
  const swings = [];
  for (const p of peaks) {
    const peak = w[p], tP = norm[p].t;
    // top of backswing: nearest local minimum before the peak, at least 0.12 s earlier
    let m = p; while (m > 0 && norm[p].t - norm[m].t < 0.12) m--;
    while (m > 0 && !(w[m] <= w[m - 1] && w[m] <= w[m + 1]) && norm[p].t - norm[m].t < 1.2) m--;
    // start of motion: walking back from the top until the envelope is below 12% of peak or 2.5 s elapsed
    const low = Math.max(peak * 0.12, 0.3);
    let s = m; while (s > 0 && w[s] < low && norm[m].t - norm[s].t < 0.6) s--;      // leave the top-of-backswing plateau
    while (s > 0 && w[s] >= low && norm[p].t - norm[s].t < 2.5) s--;              // back through the backswing to quiet
    const back = norm[m].t - norm[s].t, down = tP - norm[m].t;
    if (down <= 0.05 || back <= 0.05) continue;
    swings.push({ t_start: r2(norm[s].t - norm[0].t), t_top: r2(norm[m].t - norm[0].t), t_peak: r2(tP - norm[0].t), backswing_s: r2(back), downswing_s: r2(down), tempo_ratio: r2(back / down), peak_rotation_rad_s: r2(peak), total_s: r2(back + down) });
  }
  return { swings, sample_hz: Math.round(hz) };
}

/** Build the post-session review. marked_reps = reps the golfer marked complete. */
export function reviewSession({ samples, placement = 'unknown', source = 'phone', marked_reps = null }) {
  const norm = normalise(samples);
  const { swings, sample_hz } = detectSwings(norm);
  const n = swings.length;
  const ratios = swings.map(s => s.tempo_ratio), totals = swings.map(s => s.total_s), peaks = swings.map(s => s.peak_rotation_rad_s);
  const facts = { engine_version: ENGINE_VERSION, source, placement, placement_label: PLACEMENTS[placement] || PLACEMENTS.unknown, sample_count: norm.length, sample_hz, recording_s: norm.length ? r2(norm[norm.length - 1].t - norm[0].t) : 0, swings_detected: n, marked_reps, tempo_ratio_mean: r2(mean(ratios)), tempo_ratio_cv: r2(cv(ratios)), total_s_mean: r2(mean(totals)), total_s_cv: r2(cv(totals)), peak_rotation_mean: r2(mean(peaks)), peak_rotation_cv: r2(cv(peaks)) };
  const observations = [], next = [];
  const boundary = `${facts.placement_label}: experimental movement-event estimates, not validated swing phases, impact or technique. Not force, pressure, centre of pressure, clubface or ball data. A single sensor cannot establish body-segment sequence.`;
  facts.experimental = true;
  if (sample_hz && sample_hz < 40) observations.push(`Delivered sample rate: approximately ${sample_hz} Hz. Timing estimates may be coarse.`);
  if (!n) {
    observations.push('No candidate movement events were detected. This does not establish whether a swing occurred.');
    next.push('Check sensor permission, placement and signal delivery. Keep the coach-assigned drill unchanged.');
    return { facts, swings, observations, next, boundary, quality: 'no_signal' };
  }
  observations.push(`${n} candidate movement events detected; ${marked_reps ?? 'unknown'} repetitions marked by the golfer. Waggles and phone handling may count as events.`);
  observations.push(`Mean estimated onset-to-peak interval: ${facts.total_s_mean} s. Event-interval variation: ${Math.round(facts.total_s_cv * 100)}%.`);
  observations.push(`Heuristic pre-minimum to post-minimum interval ratio: ${facts.tempo_ratio_mean}:1. These boundaries are not verified backswing or downswing events and have no normative target.`);
  let drift = false;
  if (n >= 4) {
    const half = Math.floor(n / 2);
    const early = mean(swings.slice(0, half).map(s => s.tempo_ratio));
    const late = mean(swings.slice(-half).map(s => s.tempo_ratio));
    drift = Math.abs(late - early) > 0.4;
    if (drift) observations.push(`Estimated interval ratio changed from ${r2(early)}:1 in the first half to ${r2(late)}:1 in the second. Cause is unknown; this does not diagnose rushing or sequencing.`);
  }
  const steady = facts.total_s_cv <= 0.12 && facts.tempo_ratio_cv <= 0.2;
  next.push('Keep the coach-assigned cue and workload unchanged. Do not alter technique or advance a stage based on this experimental review.');
  next.push('Compare the candidate event count with the actual repetitions and review any disagreement with Tim. A synchronised reference recording is needed before validating swing phases.');
  return { facts, swings, observations, next, boundary, quality: drift ? 'drifting' : steady ? 'steady' : 'variable' };
}

/** Readiness context -> workload suggestion. Never changes the cue or module. */
export function workloadGuidance(score, planned_reps = 8) {
  if (score == null || !Number.isFinite(Number(score))) return { band: 'unknown', suggested_reps: planned_reps, suggested_mode: null, note: 'No readiness signal. Plan as assigned.' };
  const s = Number(score);
  if (s >= 85) return { band: 'high', suggested_reps: planned_reps, suggested_mode: null, note: 'Recovery looks strong. Full plan as assigned.' };
  if (s >= 70) return { band: 'normal', suggested_reps: planned_reps, suggested_mode: null, note: 'Recovery normal. Plan as assigned.' };
  if (s >= 60) return { band: 'low', suggested_reps: Math.max(4, planned_reps - 2), suggested_mode: 'reflect', note: 'Recovery below your usual. Consider fewer reps or Reflection mode. The cue does not change.' };
  return { band: 'very_low', suggested_reps: 4, suggested_mode: 'demonstrate', note: 'Recovery low. A short Demonstration-mode rehearsal keeps the pattern without load. The cue does not change.' };
}

/** Synthetic swing generator for tests and demos (rad/s envelope). */
export function synthSwings({ n = 6, hz = 100, back_s = 0.9, down_s = 0.3, peak = 6, gap_s = 2.0, jitter = 0, drift_down = 0 } = {}) {
  const out = []; let t = 0; const dt = 1 / hz; const rnd = () => (Math.random() - 0.5) * 2;
  const quiet = (d) => { for (let i = 0; i < d * hz; i++) { out.push({ t, gx: 0.02 * rnd(), gy: 0.02 * rnd(), gz: 0.02 * rnd(), ax: 0.01 * rnd(), ay: 0, az: 0 }); t += dt; } };
  quiet(1.5);
  for (let k = 0; k < n; k++) {
    const b = back_s * (1 + jitter * rnd()), d = Math.max(0.12, (down_s - drift_down * k) * (1 + jitter * rnd())), pk = peak * (1 + jitter * rnd());
    for (let i = 0; i < b * hz; i++) { const x = i / (b * hz); out.push({ t, gx: pk * 0.35 * Math.sin(Math.PI * x), gy: 0, gz: 0, ax: 0, ay: 0, az: 0 }); t += dt; }
    for (let i = 0; i < d * hz; i++) { const x = i / (d * hz); out.push({ t, gx: pk * Math.sin(Math.PI * x) ** 0.7, gy: 0, gz: 0, ax: 0, ay: 0, az: 0 }); t += dt; }
    for (let i = 0; i < 0.4 * hz; i++) { const x = i / (0.4 * hz); out.push({ t, gx: pk * 0.5 * (1 - x), gy: 0, gz: 0, ax: 0, ay: 0, az: 0 }); t += dt; }
    quiet(gap_s);
  }
  return out;
}
