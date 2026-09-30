// The sim clock: the ONLY source of time. Everything astronomical reads simNow().
//
// Real elapsed time is measured with Date.now() rather than performance.now():
// over weeks unattended, performance.now() can pause during system sleep and drift
// from the wall clock, and at x1 the piece must stay true to the real time.

const listeners = new Set();

let anchorSim = Date.now();
let anchorReal = anchorSim;
let speed = 1;
let paused = false;

function realNow() {
  return Date.now();
}

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

// ?t=<ISO> starts paused at that time, but only with ?gui. The public page ignores it.
export function initFromUrl(params) {
  if (!params.has('gui') || !params.has('t')) return;
  const t = Date.parse(params.get('t'));
  if (Number.isNaN(t)) {
    console.warn('clock: ignoring unparseable ?t=', params.get('t'));
    return;
  }
  anchorSim = t;
  anchorReal = realNow();
  paused = true;
}
