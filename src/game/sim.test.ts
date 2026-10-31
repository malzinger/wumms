import { describe, expect, it } from 'vitest'
import { ALL_OFF, ALL_ON, createState, punch, step, TIMING, type State, type Toggles } from './sim'

const rng = () => 0.5

function run(s: State, ms: number, toggles: Toggles, dt = 1000 / 120) {
  for (let t = 0; t < ms; t += dt) step(s, dt, toggles, rng)
}

function punchAndLand(toggles: Toggles) {
  const s = createState()
  punch(s, toggles)
  const windup = toggles.anticipation ? TIMING.windup : TIMING.windupFast
  run(s, windup + TIMING.strike + 10, toggles)
  return s
}

describe('punch', () => {
  it('lands once and records the contact at t = 0 on the timeline', () => {
    const s = punchAndLand(ALL_ON)
    expect(s.hits).toBe(1)
    expect(s.timeline.find((e) => e.kind === 'contact')?.t).toBe(0)
    expect(s.timeline.find((e) => e.kind === 'windup')?.t).toBe(-TIMING.windup)
  })

  it('ignores a second punch while the first is in flight', () => {
    const s = createState()
    punch(s, ALL_ON)
    run(s, 40, ALL_ON)
    punch(s, ALL_ON)
    expect(s.phase).toBe('windup')
    run(s, 400, ALL_ON)
    expect(s.hits).toBe(1)
  })

  it('is faster without anticipation', () => {
    const fast = punchAndLand(ALL_OFF)
    const slow = punchAndLand({ ...ALL_OFF, anticipation: true })
    expect(fast.hits).toBe(1)
    expect(slow.hits).toBe(1)
    expect(slow.t).toBeGreaterThan(fast.t + 80)
  })
})

describe('hitstop', () => {
  it('freezes simulation time for the hitstop duration', () => {
    const s = punchAndLand({ ...ALL_OFF, hitstop: true })
    const t0 = s.t
    run(s, TIMING.hitstop - 5, ALL_OFF)
    expect(s.t).toBe(t0)
    run(s, 40, ALL_OFF)
    expect(s.t).toBeGreaterThan(t0)
    expect(s.timeline.map((e) => e.kind)).toContain('hitstop_end')
  })

  it('does not freeze when the toggle is off', () => {
    const s = punchAndLand(ALL_OFF)
    const t0 = s.t
    run(s, 30, ALL_OFF)
    expect(s.t).toBeGreaterThan(t0)
  })
})

describe('shake and dummy', () => {
  it('adds trauma on impact that decays to zero', () => {
    const s = punchAndLand({ ...ALL_OFF, shake: true })
    expect(s.trauma).toBeGreaterThan(0.5)
    run(s, 600, ALL_OFF)
    expect(s.trauma).toBe(0)
    expect(s.shake).toEqual({ x: 0, y: 0, rot: 0 })
    expect(s.timeline.map((e) => e.kind)).toContain('shake_settled')
  })

  it('knocks the dummy back further with knockback on, and it always settles', () => {
    const weak = punchAndLand(ALL_OFF)
    const strong = punchAndLand({ ...ALL_OFF, knockback: true })
    expect(Math.abs(strong.dummy.vel)).toBeGreaterThan(Math.abs(weak.dummy.vel) * 3)
    run(strong, 4000, ALL_OFF)
    expect(Math.abs(strong.dummy.angle)).toBeLessThan(0.01)
    expect(strong.timeline.map((e) => e.kind)).toContain('dummy_settled')
  })

  it('spawns particles only with the toggle on and clears them', () => {
    const on = punchAndLand({ ...ALL_OFF, particles: true })
    const off = punchAndLand(ALL_OFF)
    expect(on.particles.length).toBe(16)
    expect(off.particles.length).toBe(0)
    run(on, 1000, ALL_OFF)
    expect(on.particles.length).toBe(0)
  })
})
