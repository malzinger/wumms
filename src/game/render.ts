import { fistPosition, shoulderPosition, STAGE, type State, type Toggles } from './sim'

export interface Palette {
  paper: string
  paperDeep: string
  ink: string
  red: string
}

/** Newsprint, ink and one spot colour. The impact frame swaps paper and ink. */
export const PALETTE: Palette = {
  paper: '#ece4d2',
  paperDeep: '#ddd2bb',
  ink: '#17140f',
  red: '#d3321d',
}

const INVERTED: Palette = {
  paper: '#17140f',
  paperDeep: '#221e17',
  ink: '#ece4d2',
  red: '#d3321d',
}

/** How far the bag visibly swings per radian of the simulated spring. */
const SWING = 0.22
const WORD = 'WUMMS!'
/** Spike lengths of the impact burst, irregular on purpose. */
const SPIKES = [
  1, 0.52, 0.86, 0.48, 1.12, 0.58, 0.8, 0.5, 1.02, 0.46, 0.9, 0.55, 1.08, 0.5, 0.84, 0.6,
]

type Pt = { x: number; y: number }

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const patterns = new Map<string, CanvasPattern | null>()

function pattern(
  ctx: CanvasRenderingContext2D,
  key: string,
  size: number,
  draw: (c: CanvasRenderingContext2D) => void,
): CanvasPattern | null {
  let p = patterns.get(key)
  if (p === undefined) {
    const tile = document.createElement('canvas')
    tile.width = size
    tile.height = size
    const c = tile.getContext('2d')
    if (c) draw(c)
    p = c ? ctx.createPattern(tile, 'repeat') : null
    patterns.set(key, p)
  }
  return p
}

/** A printed halftone screen in the current ink colour. */
function halftone(ctx: CanvasRenderingContext2D, pal: Palette) {
  return pattern(ctx, `dots${pal.ink}`, 7, (c) => {
    c.fillStyle = pal.ink
    c.beginPath()
    c.arc(3.5, 3.5, 1.45, 0, Math.PI * 2)
    c.fill()
  })
}

/** Paper grain: a fixed tile of faint specks, so it never shimmers. */
function grain(ctx: CanvasRenderingContext2D, pal: Palette) {
  return pattern(ctx, `grain${pal.ink}`, 160, (c) => {
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < 900; i++) {
      c.fillStyle = rgba(pal.ink, 0.02 + rnd() * 0.06)
      c.fillRect(rnd() * 160, rnd() * 160, 1 + rnd(), 1 + rnd())
    }
  })
}

/** Elbow or knee for a two-bone limb from `a` to `b`; `bend` picks the side. */
function joint(a: Pt, b: Pt, l1: number, l2: number, bend: 1 | -1): Pt {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.max(1, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01))
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
  const ang = Math.atan2(dy, dx) + Math.acos(Math.max(-1, Math.min(1, cos))) * bend
  return { x: a.x + Math.cos(ang) * l1, y: a.y + Math.sin(ang) * l1 }
}

function seg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, w: number) {
  ctx.lineWidth = w
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

/** Draws one frame. `width`/`height` are CSS pixels; the stage is scaled to fit. */
export function render(
  ctx: CanvasRenderingContext2D,
  s: State,
  toggles: Toggles,
  width: number,
  height: number,
): void {
  // The first frames after contact are printed in negative.
  const pal = s.flash > 0.55 ? INVERTED : PALETTE
  const scale = Math.min(width / STAGE.w, height / STAGE.h)

  ctx.save()
  ctx.fillStyle = pal.paper
  ctx.fillRect(0, 0, width, height)
  ctx.translate((width - STAGE.w * scale) / 2, (height - STAGE.h * scale) / 2)
  ctx.scale(scale, scale)

  // Camera: punch zoom about the impact point, then shake.
  const zoom = 1 + s.zoom * 0.06
  const fx = STAGE.dummyX - STAGE.bagRadius
  const fy = STAGE.floor - 150
  ctx.translate(fx, fy)
  ctx.scale(zoom, zoom)
  ctx.rotate(s.shake.rot)
  ctx.translate(-fx + s.shake.x, -fy + s.shake.y)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  drawRoom(ctx, pal)
  drawShadows(ctx, s, pal)
  drawBag(ctx, s, pal)
  drawBurst(ctx, s, pal)
  drawTrail(ctx, s, toggles, pal)
  drawFighter(ctx, s, pal)
  drawParticles(ctx, s, pal)
  drawWord(ctx, s, toggles, pal)
  ctx.restore()

  const g = grain(ctx, pal)
  if (g) {
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
  }
}

function drawRoom(ctx: CanvasRenderingContext2D, pal: Palette) {
  const F = STAGE.floor
  const x0 = -200
  const x1 = STAGE.w + 200

  // A band of printed tone on the wall, fading up from the floor.
  const dots = halftone(ctx, pal)
  if (dots) {
    ctx.fillStyle = dots
    ctx.fillRect(x0, F - 120, x1 - x0, 120)
    const fade = ctx.createLinearGradient(0, F - 120, 0, F)
    fade.addColorStop(0, pal.paper)
    fade.addColorStop(1, rgba(pal.paper, 0.45))
    ctx.fillStyle = fade
    ctx.fillRect(x0, F - 120, x1 - x0, 120)
  }

  ctx.fillStyle = pal.paperDeep
  ctx.fillRect(x0, F, x1 - x0, STAGE.h + 200)

  // Floor lines, spreading out towards the viewer.
  ctx.strokeStyle = pal.ink
  for (const [dy, a] of [
    [14, 0.5],
    [36, 0.35],
    [68, 0.22],
  ] as const) {
    ctx.globalAlpha = a
    seg(ctx, { x: x0, y: F + dy }, { x: x1, y: F + dy }, 1.2)
  }
  ctx.globalAlpha = 1
  seg(ctx, { x: x0, y: F }, { x: x1, y: F }, 3)
}

function drawShadows(ctx: CanvasRenderingContext2D, s: State, pal: Palette) {
  const F = STAGE.floor
  const swing = Math.sin(s.dummy.angle * SWING)
  const bagX = STAGE.dummyX + swing * (STAGE.bagBottom - STAGE.pivotY)
  ctx.fillStyle = pal.ink
  ctx.beginPath()
  ctx.ellipse(STAGE.fighterX + s.fighter.lean * 16, F + 2, 74, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  // The hanging bag's shadow is fainter and spreads as it swings away.
  ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.ellipse(bagX, F + 3, 44 + Math.abs(swing) * 30, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawBag(ctx: CanvasRenderingContext2D, s: State, pal: Palette) {
  const cx = STAGE.dummyX
  const R = STAGE.bagRadius
  const T = STAGE.bagTop
  const B = STAGE.bagBottom
  const hitY = STAGE.floor - 144

  ctx.save()
  ctx.translate(cx, STAGE.pivotY)
  ctx.rotate(-s.dummy.angle * SWING)
  ctx.translate(-cx, -STAGE.pivotY)

  // Chain, ring and straps.
  ctx.strokeStyle = pal.ink
  for (let i = 0, y = STAGE.pivotY; y < 70; i++, y += 13) {
    if (i % 2 === 0) {
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(cx, y + 6, 4.5, 8, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      seg(ctx, { x: cx, y: y + 1 }, { x: cx, y: y + 11 }, 4)
    }
  }
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(cx, 80, 7, 0, Math.PI * 2)
  ctx.stroke()
  for (const dx of [-38, 0, 38]) seg(ctx, { x: cx, y: 86 }, { x: cx + dx, y: T + 4 }, 2.5)

  // Body. Squash narrows it along the punch and dents the struck side.
  const sq = s.dummy.squash
  ctx.translate(cx, hitY)
  ctx.scale(1 - 0.16 * sq, 1 + 0.06 * sq)
  ctx.translate(-cx, -hitY)
  const L = cx - R
  const Rx = cx + R
  const dent = 16 * sq
  ctx.beginPath()
  ctx.moveTo(L + 12, T)
  ctx.lineTo(Rx - 12, T)
  ctx.quadraticCurveTo(Rx, T, Rx, T + 12)
  ctx.lineTo(Rx, B - 30)
  ctx.quadraticCurveTo(Rx, B, cx, B)
  ctx.quadraticCurveTo(L, B, L, B - 30)
  ctx.lineTo(L, hitY + 54)
  ctx.quadraticCurveTo(L + dent * 2, hitY, L, hitY - 54)
  ctx.lineTo(L, T + 12)
  ctx.quadraticCurveTo(L, T, L + 12, T)
  ctx.closePath()
  ctx.fillStyle = pal.ink
  ctx.fill()

  // Paper-coloured detail: rim light, cap seam and stitching.
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = pal.paper
  seg(ctx, { x: L + 11, y: T + 30 }, { x: L + 11 + dent * 0.6, y: B - 36 }, 2.5)
  seg(ctx, { x: L + 18, y: T + 44 }, { x: L + 18 + dent * 0.6, y: B - 60 }, 1.2)
  seg(ctx, { x: L, y: T + 20 }, { x: Rx, y: T + 20 }, 2.5)
  ctx.setLineDash([6, 5])
  seg(ctx, { x: L, y: T + 34 }, { x: Rx, y: T + 34 }, 1.6)
  seg(ctx, { x: L, y: B - 48 }, { x: Rx, y: B - 48 }, 1.6)
  ctx.setLineDash([])
  ctx.restore()
  ctx.restore()
}

function drawBurst(ctx: CanvasRenderingContext2D, s: State, pal: Palette) {
  if (s.flash < 0.04) return
  const c = { x: STAGE.dummyX - STAGE.bagRadius - 6, y: STAGE.floor - 144 }
  const r = 44 + (1 - s.flash) * 46
  const star = (k: number) => {
    ctx.beginPath()
    SPIKES.forEach((m, i) => {
      const a = (i / SPIKES.length) * Math.PI * 2 + 0.2
      const rr = r * k * m
      if (i === 0) ctx.moveTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr)
      else ctx.lineTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr)
    })
    ctx.closePath()
  }
  ctx.globalAlpha = Math.min(1, s.flash * 2.2)
  ctx.lineJoin = 'miter'
  star(1)
  ctx.fillStyle = pal.red
  ctx.fill()
  ctx.strokeStyle = pal.ink
  ctx.lineWidth = 3
  ctx.stroke()
  star(0.42)
  ctx.fillStyle = pal.paper
  ctx.fill()
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 1
}

/** Speed lines behind the fist, like a brush dragged through the motion. */
function drawTrail(ctx: CanvasRenderingContext2D, s: State, toggles: Toggles, pal: Palette) {
  if (!toggles.trail || s.trail.length < 3) return
  const lines = [
    { dy: -14, w: 2, keep: 1 },
    { dy: -7, w: 3.5, keep: 0.75 },
    { dy: 1, w: 2.5, keep: 0.95 },
    { dy: 9, w: 3, keep: 0.6 },
    { dy: 16, w: 1.5, keep: 0.45 },
  ]
  ctx.strokeStyle = pal.ink
  for (const l of lines) {
    const pts = s.trail.filter((t) => t.age <= 140 * l.keep)
    if (pts.length < 2) continue
    ctx.lineWidth = l.w
    ctx.beginPath()
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x - 16, p.y + l.dy)
      else ctx.lineTo(p.x - 16, p.y + l.dy)
    })
    ctx.stroke()
  }
}

function drawGlove(ctx: CanvasRenderingContext2D, p: Pt, angle: number, k: number, pal: Palette) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(angle)
  ctx.scale(k, k)
  ctx.strokeStyle = pal.ink
  ctx.lineWidth = 3
  ctx.fillStyle = pal.red
  ctx.fillRect(-25, -10, 12, 20)
  ctx.strokeRect(-25, -10, 12, 20)
  ctx.beginPath()
  ctx.ellipse(0, 0, 19, 16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(-2, 8, 8, 5, -0.2, Math.PI * 1.05, Math.PI * 2.1)
  ctx.stroke()
  ctx.strokeStyle = pal.paper
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(-1, -1, 11, Math.PI * 1.15, Math.PI * 1.55)
  ctx.stroke()
  ctx.restore()
}

/** The fighter is one ink silhouette; only the gloves carry colour. */
function drawFighter(ctx: CanvasRenderingContext2D, s: State, pal: Palette) {
  const X = STAGE.fighterX
  const F = STAGE.floor
  const lean = s.fighter.lean
  const st = s.fighter.stretch

  ctx.save()
  // Squash and stretch around the feet: stretched forward on the strike, compressed on the wind-up.
  ctx.translate(X, F)
  ctx.scale(1 + st, 1 - st * 0.7)
  ctx.translate(-X, -F)
  ctx.strokeStyle = pal.ink
  ctx.fillStyle = pal.ink

  const top = { x: X + lean * 30, y: F - 148 }
  const hip = { x: X + lean * 12, y: F - 84 }
  const head = { x: top.x + 10 + lean * 4, y: top.y - 36 }
  const rearShoulder = { x: top.x - 14, y: top.y + 2 }
  const rearGlove = { x: top.x + 26 + lean * 4, y: top.y - 26 }
  const rearElbow = joint(rearShoulder, rearGlove, 38, 36, 1)

  seg(ctx, rearShoulder, rearElbow, 15)

  // Legs: knees bend forward, feet stay planted.
  for (const side of [-1, 1] as const) {
    const h = { x: hip.x + side * 10, y: hip.y }
    const ankle = { x: X + side * 46 + (side > 0 ? Math.max(0, lean) * 8 : 0), y: F - 8 }
    const knee = joint(h, ankle, 46, 44, -1)
    seg(ctx, h, knee, 22)
    seg(ctx, knee, ankle, 17)
    seg(ctx, ankle, { x: ankle.x + 22, y: F - 4 }, 11)
  }

  // Torso: broad shoulders, narrow waist, a curved back.
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(hip.x - 16, hip.y - 6)
  ctx.quadraticCurveTo(top.x - 34, (hip.y + top.y) / 2, top.x - 24, top.y - 2)
  ctx.quadraticCurveTo(top.x, top.y - 12, top.x + 26, top.y + 2)
  ctx.quadraticCurveTo(top.x + 14, (hip.y + top.y) / 2 + 4, hip.x + 16, hip.y - 6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Trunks in spot red, with an ink waistband.
  ctx.fillStyle = pal.red
  ctx.beginPath()
  ctx.moveTo(hip.x - 22, hip.y - 12)
  ctx.lineTo(hip.x + 20, hip.y - 12)
  ctx.lineTo(hip.x + 28, hip.y + 14)
  ctx.lineTo(hip.x + 4, hip.y + 16)
  ctx.lineTo(hip.x, hip.y + 6)
  ctx.lineTo(hip.x - 6, hip.y + 16)
  ctx.lineTo(hip.x - 28, hip.y + 13)
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.fillStyle = pal.ink
  ctx.fillRect(hip.x - 23, hip.y - 15, 44, 7)

  // Neck, head, nose and one paper eye.
  seg(ctx, top, head, 14)
  ctx.beginPath()
  ctx.arc(head.x, head.y, 22, 0, Math.PI * 2)
  ctx.arc(head.x + 21, head.y + 3, 5.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = pal.paper
  seg(ctx, { x: head.x + 9, y: head.y - 3 }, { x: head.x + 16, y: head.y - 4 }, 2.5)
  ctx.strokeStyle = pal.ink

  // Rear forearm and guard glove in front of the chin.
  seg(ctx, rearElbow, rearGlove, 13)
  drawGlove(
    ctx,
    rearGlove,
    Math.atan2(rearGlove.y - rearElbow.y, rearGlove.x - rearElbow.x),
    0.9,
    pal,
  )

  // Punching arm.
  const sh = shoulderPosition(s)
  const fist = fistPosition(s)
  const elbow = joint(sh, fist, 48, 46, 1)
  seg(ctx, sh, elbow, 17)
  seg(ctx, elbow, fist, 15)
  drawGlove(ctx, fist, Math.atan2(fist.y - elbow.y, fist.x - elbow.x), 1, pal)

  ctx.restore()
}

/** Sparks as ink spatter: a streak along the velocity and a drop at the head. */
function drawParticles(ctx: CanvasRenderingContext2D, s: State, pal: Palette) {
  for (const p of s.particles) {
    const a = 1 - p.age / p.ttl
    const col = p.red ? pal.red : pal.ink
    ctx.strokeStyle = col
    ctx.fillStyle = col
    seg(ctx, p, { x: p.x - p.vx * 0.022, y: p.y - p.vy * 0.022 }, 1 + p.size * 0.5 * a)
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * 0.5 * (0.4 + 0.6 * a), 0, Math.PI * 2)
    ctx.fill()
  }
}

/** The sound, lettered onto the stage like a comic panel. */
function drawWord(ctx: CanvasRenderingContext2D, s: State, toggles: Toggles, pal: Palette) {
  if (!toggles.sound || s.contactAt === null) return
  const age = s.t - s.contactAt
  if (age > 560) return
  const pop = 1 + 0.3 * Math.exp(-age / 45)
  ctx.save()
  ctx.globalAlpha = age < 380 ? 1 : 1 - (age - 380) / 180
  ctx.translate(250, 96)
  ctx.rotate(-0.08)
  ctx.scale(pop, pop)
  ctx.font = '900 76px "Big Shoulders Display Variable", Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = pal.ink
  ctx.fillText(WORD, 5, 5)
  ctx.strokeStyle = pal.ink
  ctx.lineWidth = 8
  ctx.strokeText(WORD, 0, 0)
  ctx.fillStyle = pal.red
  ctx.fillText(WORD, 0, 0)
  ctx.restore()
}
