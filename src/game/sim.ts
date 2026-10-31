/**
 * The whole demo in one deterministic step function: a fighter throws one punch at a
 * training dummy, and every "juice" technique is a toggle that changes how that punch
 * looks and feels. Time is in milliseconds; the caller scales dt for slow motion.
 */

export const TOGGLE_IDS = [
  'anticipation',
  'squash',
  'hitstop',
  'shake',
  'particles',
  'flash',
  'knockback',
  'trail',
  'zoom',
  'sound',
] as const
export type ToggleId = (typeof TOGGLE_IDS)[number]
export type Toggles = Record<ToggleId, boolean>

export const ALL_ON: Toggles = Object.fromEntries(TOGGLE_IDS.map((k) => [k, true])) as Toggles
export const ALL_OFF: Toggles = Object.fromEntries(TOGGLE_IDS.map((k) => [k, false])) as Toggles

export type Phase = 'idle' | 'windup' | 'strike' | 'recover'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  ttl: number
  size: number
  hue: number
}

export type EventKind = 'windup' | 'contact' | 'hitstop_end' | 'shake_settled' | 'dummy_settled'

export interface TimelineEvent {
  /** Milliseconds relative to contact; negative events happen before the hit. */
  t: number
  kind: EventKind
}

export interface State {
  t: number
  phase: Phase
  phaseT: number
  hitstop: number
  trauma: number
  shake: { x: number; y: number; rot: number }
  dummy: { angle: number; vel: number; squash: number }
  fighter: { armExt: number; stretch: number; lean: number }
  trail: Array<{ x: number; y: number; age: number }>
  flash: number
  zoom: number
  particles: Particle[]
  hits: number
  /** Events of the most recent punch; cleared when a new windup starts. */
  timeline: TimelineEvent[]
  contactAt: number | null
  settled: { shake: boolean; dummy: boolean }
  /** Set for one step when contact happens so the caller can play sounds. */
  justHit: boolean
  justSwung: boolean
}

export const TIMING = {
  windup: 120,
  windupFast: 25,
  strike: 70,
  recover: 180,
  hitstop: 85,
}

/** Where things sit on the 900 x 500 stage. */
export const STAGE = {
  w: 900,
  h: 500,
  floor: 400,
  fighterX: 290,
  dummyX: 600,
  bagLength: 230,
  bagRadius: 46,
}

export function createState(): State {
  return {
    t: 0,
    phase: 'idle',
    phaseT: 0,
    hitstop: 0,
    trauma: 0,
    shake: { x: 0, y: 0, rot: 0 },
    dummy: { angle: 0, vel: 0, squash: 0 },
    fighter: { armExt: 0, stretch: 0, lean: 0 },
    trail: [],
    flash: 0,
    zoom: 0,
    particles: [],
    hits: 0,
    timeline: [],
    contactAt: null,
    settled: { shake: true, dummy: true },
    justHit: false,
    justSwung: false,
  }
}

/** Starts a punch; ignored while one is already in flight. */
export function punch(s: State, toggles: Toggles): void {
  if (s.phase !== 'idle' && s.phase !== 'recover') return
  s.phase = 'windup'
  s.phaseT = 0
  s.timeline = []
  s.contactAt = null
  s.settled = { shake: false, dummy: false }
  s.timeline.push({
    t: -(toggles.anticipation ? TIMING.windup : TIMING.windupFast),
    kind: 'windup',
  })
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const easeOutBack = (x: number) => 1 + 2.3 * Math.pow(x - 1, 3) + 1.3 * Math.pow(x - 1, 2)

export function step(
  s: State,
  dt: number,
  toggles: Toggles,
  rng: () => number = Math.random,
): void {
  s.justHit = false
  s.justSwung = false
  if (dt <= 0) return

  // Hitstop freezes the scene; the camera shake keeps running on the frozen frame.
  if (s.hitstop > 0) {
    s.hitstop = Math.max(0, s.hitstop - dt)
    if (s.hitstop === 0 && s.contactAt !== null) {
      s.timeline.push({ t: TIMING.hitstop, kind: 'hitstop_end' })
    }
    return
  }

  s.t += dt
  s.phaseT += dt

  const windup = toggles.anticipation ? TIMING.windup : TIMING.windupFast
  switch (s.phase) {
    case 'windup': {
      const p = clamp01(s.phaseT / windup)
      s.fighter.armExt = -0.35 * p
      s.fighter.lean = -0.5 * p
      s.fighter.stretch = toggles.squash ? -0.12 * p : 0
      if (s.phaseT >= windup) {
        s.phase = 'strike'
        s.phaseT = 0
        s.justSwung = true
      }
      break
    }
    case 'strike': {
      const p = clamp01(s.phaseT / TIMING.strike)
      s.fighter.armExt = -0.35 + 1.35 * easeOutBack(p)
      s.fighter.lean = -0.5 + 1.3 * p
      s.fighter.stretch = toggles.squash ? 0.22 * Math.sin(p * Math.PI) : 0
      if (s.phaseT >= TIMING.strike) contact(s, toggles, rng)
      break
    }
    case 'recover': {
      const p = clamp01(s.phaseT / TIMING.recover)
      s.fighter.armExt = 1 - p
      s.fighter.lean = 0.8 * (1 - p)
      s.fighter.stretch = toggles.squash ? -0.08 * Math.sin(p * Math.PI) : 0
      if (s.phaseT >= TIMING.recover) {
        s.phase = 'idle'
        s.phaseT = 0
        s.fighter.armExt = 0
        s.fighter.lean = 0
        s.fighter.stretch = 0
      }
      break
    }
    default:
      break
  }

  const sec = dt / 1000

  // Dummy: a damped spring on a base pivot. Squash is a separate, faster decay.
  const k = 60
  const c = 5.5
  s.dummy.vel += (-k * s.dummy.angle - c * s.dummy.vel) * sec
  s.dummy.angle += s.dummy.vel * sec
  s.dummy.squash *= Math.exp(-9 * sec)
  if (
    !s.settled.dummy &&
    s.contactAt !== null &&
    Math.abs(s.dummy.angle) < 0.01 &&
    Math.abs(s.dummy.vel) < 0.1
  ) {
    s.settled.dummy = true
    s.timeline.push({ t: s.t - s.contactAt, kind: 'dummy_settled' })
  }

  // Trauma-based shake: decays linearly, offset grows with trauma squared.
  s.trauma = Math.max(0, s.trauma - 2.4 * sec)
  const amp = s.trauma * s.trauma
  s.shake = {
    x: amp * 14 * (rng() * 2 - 1),
    y: amp * 10 * (rng() * 2 - 1),
    rot: amp * 0.035 * (rng() * 2 - 1),
  }
  if (!s.settled.shake && s.contactAt !== null && s.trauma < 0.02) {
    s.settled.shake = true
    s.timeline.push({ t: s.t - s.contactAt, kind: 'shake_settled' })
  }

  s.flash *= Math.exp(-14 * sec)
  s.zoom *= Math.exp(-7 * sec)

  for (const p of s.particles) {
    p.age += dt
    p.x += p.vx * sec
    p.y += p.vy * sec
    p.vy += 900 * sec
    p.vx *= Math.exp(-1.8 * sec)
  }
  s.particles = s.particles.filter((p) => p.age < p.ttl)

  if (toggles.trail && s.phase !== 'idle') {
    const fist = fistPosition(s)
    s.trail.push({ x: fist.x, y: fist.y, age: 0 })
  }
  for (const t of s.trail) t.age += dt
  s.trail = s.trail.filter((t) => t.age < 140)
}

function contact(s: State, toggles: Toggles, rng: () => number): void {
  s.phase = 'recover'
  s.phaseT = 0
  s.hits++
  s.contactAt = s.t
  s.justHit = true
  s.timeline.push({ t: 0, kind: 'contact' })

  s.dummy.vel += toggles.knockback ? 11 : 1.6
  if (toggles.squash) s.dummy.squash = 1
  if (toggles.hitstop) s.hitstop = TIMING.hitstop
  if (toggles.shake) s.trauma = Math.min(1, s.trauma + 0.65)
  if (toggles.flash) s.flash = 1
  if (toggles.zoom) s.zoom = 1
  if (toggles.particles) {
    const fist = fistPosition(s)
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 2.2
      const speed = 260 + rng() * 420
      s.particles.push({
        x: fist.x,
        y: fist.y,
        vx: Math.cos(a) * speed + 180,
        vy: Math.sin(a) * speed,
        age: 0,
        ttl: 320 + rng() * 380,
        size: 3 + rng() * 5,
        hue: rng() < 0.7 ? 46 : 18,
      })
    }
  }
}

/** Fist position in stage coordinates, derived from the arm extension. */
export function fistPosition(s: State): { x: number; y: number } {
  const shoulderX = STAGE.fighterX + 26 + s.fighter.lean * 10
  const shoulderY = STAGE.floor - 150
  const reach = STAGE.dummyX - STAGE.bagRadius - 8 - shoulderX
  return { x: shoulderX + 30 + s.fighter.armExt * (reach - 30), y: shoulderY + 6 }
}
