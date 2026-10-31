import { fistPosition, STAGE, type State, type Toggles } from './sim'

export interface Palette {
  bg: string
  floor: string
  grid: string
  fighter: string
  fighterDark: string
  skin: string
  bag: string
  bagDark: string
  post: string
  flash: string
}

export const PALETTE: Palette = {
  bg: '#0f1217',
  floor: '#1c212b',
  grid: '#232935',
  fighter: '#4cc9f0',
  fighterDark: '#1c8db4',
  skin: '#ffd6a5',
  bag: '#e07a5f',
  bagDark: '#b5563f',
  post: '#5b6472',
  flash: '#ffffff',
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Draws one frame. `width`/`height` are CSS pixels; the stage is scaled to fit. */
export function render(
  ctx: CanvasRenderingContext2D,
  s: State,
  toggles: Toggles,
  width: number,
  height: number,
  pal: Palette = PALETTE,
): void {
  const scale = Math.min(width / STAGE.w, height / STAGE.h)
  const ox = (width - STAGE.w * scale) / 2
  const oy = (height - STAGE.h * scale) / 2

  ctx.save()
  ctx.fillStyle = pal.bg
  ctx.fillRect(0, 0, width, height)
  ctx.translate(ox, oy)
  ctx.scale(scale, scale)

  // Camera: punch zoom about the impact point, then shake.
  const zoom = 1 + s.zoom * 0.06
  const fx = STAGE.dummyX - STAGE.bagRadius
  const fy = STAGE.floor - 150
  ctx.translate(fx, fy)
  ctx.scale(zoom, zoom)
  ctx.rotate(s.shake.rot)
  ctx.translate(-fx + s.shake.x, -fy + s.shake.y)

  // Floor and a sparse grid so motion is visible against something.
  ctx.fillStyle = pal.floor
  ctx.fillRect(-100, STAGE.floor, STAGE.w + 200, STAGE.h)
  ctx.strokeStyle = pal.grid
  ctx.lineWidth = 1
  for (let x = -100; x <= STAGE.w + 100; x += 60) {
    ctx.beginPath()
    ctx.moveTo(x, STAGE.floor)
    ctx.lineTo(x, STAGE.h + 100)
    ctx.stroke()
  }
  for (let y = STAGE.floor; y <= STAGE.h + 100; y += 30) {
    ctx.beginPath()
    ctx.moveTo(-100, y)
    ctx.lineTo(STAGE.w + 100, y)
    ctx.stroke()
  }

  drawDummy(ctx, s, pal)
  drawTrail(ctx, s, toggles, pal)
  drawFighter(ctx, s, pal)
  drawParticles(ctx, s)

  // Impact flash: a ring expanding from the point of contact.
  if (s.flash > 0.02) {
    const fist = fistPosition(s)
    ctx.globalAlpha = s.flash * 0.9
    ctx.strokeStyle = pal.flash
    ctx.lineWidth = 6 * s.flash
    ctx.beginPath()
    ctx.arc(fist.x + 10, fist.y, 18 + (1 - s.flash) * 70, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

function drawDummy(ctx: CanvasRenderingContext2D, s: State, pal: Palette) {
  const baseX = STAGE.dummyX
  const baseY = STAGE.floor
  ctx.fillStyle = pal.post
  roundRect(ctx, baseX - 56, baseY - 14, 112, 18, 6)
  ctx.fill()

  ctx.save()
  ctx.translate(baseX, baseY - 10)
  ctx.rotate(s.dummy.angle)
  // Squash: wider and shorter on impact, anchored at the base.
  const sq = s.dummy.squash
  ctx.scale(1 + 0.28 * sq, 1 - 0.18 * sq)

  ctx.fillStyle = pal.post
  roundRect(ctx, -9, -STAGE.bagLength + STAGE.bagRadius, 18, STAGE.bagLength - STAGE.bagRadius, 6)
  ctx.fill()

  const top = -STAGE.bagLength - STAGE.bagRadius
  const bagH = STAGE.bagLength - 40
  ctx.fillStyle = pal.bag
  roundRect(ctx, -STAGE.bagRadius, top, STAGE.bagRadius * 2, bagH, STAGE.bagRadius)
  ctx.fill()
  ctx.fillStyle = pal.bagDark
  roundRect(ctx, STAGE.bagRadius - 18, top + 10, 12, bagH - 20, 6)
  ctx.fill()
  ctx.strokeStyle = 'rgba(15, 18, 23, 0.55)'
  ctx.lineWidth = 4
  for (const r of [24, 12]) {
    ctx.beginPath()
    ctx.arc(0, top + 150, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (s.flash > 0.02) {
    ctx.globalAlpha = s.flash * 0.85
    ctx.fillStyle = pal.flash
    roundRect(ctx, -STAGE.bagRadius, top, STAGE.bagRadius * 2, bagH, STAGE.bagRadius)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

function drawFighter(ctx: CanvasRenderingContext2D, s: State, pal: Palette) {
  const x = STAGE.fighterX
  const floor = STAGE.floor
  const lean = s.fighter.lean
  const st = s.fighter.stretch

  ctx.save()
  // Squash and stretch around the feet: stretched forward on the strike, compressed on the wind-up.
  ctx.translate(x, floor)
  ctx.scale(1 + st, 1 - st * 0.7)
  ctx.translate(-x, -floor)

  ctx.strokeStyle = pal.fighterDark
  ctx.lineCap = 'round'
  ctx.lineWidth = 16
  ctx.beginPath()
  ctx.moveTo(x - 10, floor - 90)
  ctx.lineTo(x - 26 - lean * 14, floor - 6)
  ctx.moveTo(x + 10, floor - 90)
  ctx.lineTo(x + 30 + lean * 24, floor - 6)
  ctx.stroke()

  ctx.fillStyle = pal.fighter
  ctx.save()
  ctx.translate(x + lean * 8, floor - 150)
  ctx.rotate(lean * 0.18)
  roundRect(ctx, -30, -40, 60, 100, 24)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = pal.skin
  ctx.beginPath()
  ctx.arc(x + 6 + lean * 14, floor - 218, 24, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = pal.fighterDark
  roundRect(ctx, x - 20 + lean * 14, floor - 246, 52, 18, 8)
  ctx.fill()

  // Rear arm, held up as a guard.
  ctx.strokeStyle = pal.fighter
  ctx.lineWidth = 18
  ctx.beginPath()
  ctx.moveTo(x - 10 + lean * 8, floor - 175)
  ctx.lineTo(x + 18 + lean * 10, floor - 196)
  ctx.stroke()
  ctx.fillStyle = pal.skin
  ctx.beginPath()
  ctx.arc(x + 22 + lean * 10, floor - 198, 13, 0, Math.PI * 2)
  ctx.fill()

  // Punching arm.
  const shoulderX = x + 26 + lean * 10
  const shoulderY = floor - 150
  const fist = fistPosition(s)
  ctx.strokeStyle = pal.fighter
  ctx.lineWidth = 20
  ctx.beginPath()
  ctx.moveTo(shoulderX, shoulderY)
  ctx.lineTo(fist.x, fist.y)
  ctx.stroke()
  ctx.fillStyle = pal.skin
  ctx.beginPath()
  ctx.arc(fist.x, fist.y, 16, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawTrail(ctx: CanvasRenderingContext2D, s: State, toggles: Toggles, pal: Palette) {
  if (!toggles.trail || s.trail.length < 2) return
  for (const t of s.trail) {
    const a = 1 - t.age / 140
    ctx.globalAlpha = a * 0.35
    ctx.fillStyle = pal.skin
    ctx.beginPath()
    ctx.arc(t.x, t.y, 16 * (0.4 + 0.6 * a), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawParticles(ctx: CanvasRenderingContext2D, s: State) {
  for (const p of s.particles) {
    const a = 1 - p.age / p.ttl
    ctx.globalAlpha = a
    ctx.fillStyle = `hsl(${p.hue} 95% ${55 + 25 * a}%)`
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}
