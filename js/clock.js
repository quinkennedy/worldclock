// The sim clock: the ONLY source of time. Everything astronomical reads simNow().
//
// Real time is the wall clock (Date.now()): over weeks unattended, performance.now() can pause
// during system sleep and drift from it, and at x1 the piece must stay true to the real time.
// But Date.now() only has 1 ms steps, and at x100000 one ms is 100 s of sim time, which makes
// fast playback stutter. So realNow() follows performance.now() for smoothness and snaps back to
// Date.now() whenever the two drift more than RESYNC_MS apart (e.g. after the system sleeps).

const RESYNC_MS = 50;

const listeners = new Set();

let perfBase = Date.now() - performance.now();

function realNow() {
  const p = performance.now();
  const wall = Date.now();
  if (Math.abs(perfBase + p - wall) > RESYNC_MS) perfBase = wall - p;
  return perfBase + p;
}

let anchorSim = realNow();
let anchorReal = anchorSim;
let speed = 1;
let paused = false;

function reanchor() {
  anchorSim = simNow();
  anchorReal = realNow();
}

function changed() {
  for (const fn of listeners) fn();
}

export function simNow() {
  return anchorSim + (paused ? 0 : (realNow() - anchorReal) * speed);
}

export function getSpeed() { return speed; }
export function isPaused() { return paused; }

// True when the clock runs at real-time rate (x1, not paused); the render loop can idle.
export function isRealRate() {
  return speed === 1 && !paused;
}

export function setSpeed(s) {
  reanchor();
  speed = s;
  changed();
}

export function setPaused(p) {
  reanchor();
  paused = p;
  changed();
}

export function setTime(utcMs) {
  anchorSim = utcMs;
  anchorReal = realNow();
  changed();
}

// Back to live: the real time at x1.
export function resetToNow() {
  anchorSim = anchorReal = realNow();
  speed = 1;
  paused = false;
  changed();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Parses an ISO date/time as UTC; returns NaN if it can't. Date.parse reads a date-time with no
// zone as local time, so a missing zone gets 'Z' (date-only strings are already UTC).
export function parseUtc(text) {
  const s = String(text).trim();
  const hasZone = /(Z|[+-]\d{2}(:?\d{2})?)$/i.test(s);
  return Date.parse(s.includes('T') && !hasZone ? s + 'Z' : s);
}

// UTC ISO string without milliseconds, e.g. 2026-03-20T12:00:00Z.
export function formatUtc(utcMs) {
  return new Date(utcMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ?t=<ISO> starts paused at that time, but only with ?gui. The public page ignores it.
export function initFromUrl(params) {
  if (!params.has('gui') || !params.has('t')) return;
  const t = parseUtc(params.get('t'));
  if (Number.isNaN(t)) {
    console.warn('clock: ignoring unparseable ?t=', params.get('t'));
    return;
  }
  anchorSim = t;
  anchorReal = realNow();
  paused = true;
}
