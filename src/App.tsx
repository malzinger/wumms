import { useEffect, useRef, useState } from 'react'
import { Synth } from './game/audio'
import { render } from './game/render'
import {
  ALL_OFF,
  ALL_ON,
  createState,
  punch,
  step,
  TIMING,
  TOGGLE_IDS,
  type TimelineEvent,
  type ToggleId,
  type Toggles,
} from './game/sim'
import { detectLang, STRINGS, type Lang, type Strings } from './ui/i18n'

const REPO_URL = 'https://github.com/malzinger/wumms'
const STEP = 1000 / 240
const SPEEDS = [1, 0.5, 0.25, 0.1]

function readToggles(): Toggles {
  const q = new URLSearchParams(location.search).get('on')
  if (q === null) return { ...ALL_ON }
  const on = new Set(q.split(',').filter(Boolean))
  return Object.fromEntries(TOGGLE_IDS.map((id) => [id, on.has(id)])) as Toggles
}

export function App() {
  const [lang, setLang] = useState<Lang>(detectLang)
  const t = STRINGS[lang]
  const [toggles, setToggles] = useState<Toggles>(readToggles)
  const [speed, setSpeed] = useState(1)
  const [hits, setHits] = useState(0)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [hitstopOn, setHitstopOn] = useState(toggles.hitstop)

  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const sim = useRef(createState())
  const live = useRef({ toggles, speed })
  const synth = useRef<Synth | null>(null)
  useEffect(() => {
    live.current = { toggles, speed }
  }, [toggles, speed])

  useEffect(() => {
    const q = new URLSearchParams(location.search)
    q.set('on', TOGGLE_IDS.filter((id) => toggles[id]).join(','))
    q.set('lang', lang)
    history.replaceState(null, '', `${location.pathname}?${q.toString()}`)
    document.documentElement.lang = lang
  }, [toggles, lang])

  const doPunch = () => {
    const s = sim.current
    const before = s.phase
    // The audio context must be created from a user gesture, so do it here.
    if (live.current.toggles.sound && !synth.current) synth.current = new Synth()
    punch(s, live.current.toggles)
    if (before !== s.phase) {
      setTimeline([])
      setHitstopOn(live.current.toggles.hitstop)
    }
  }

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    let lastLen = -1
    let lastHits = 0

    const frame = (now: number) => {
      const s = sim.current
      const { toggles: tg, speed: sp } = live.current
      acc += Math.min(50, now - last) * sp
      last = now
      while (acc >= STEP) {
        step(s, STEP, tg)
        acc -= STEP
        if (s.justSwung && tg.sound) synth.current?.whoosh()
        if (s.justHit && tg.sound) synth.current?.hit()
      }
      if (s.hits !== lastHits) {
        lastHits = s.hits
        setHits(s.hits)
      }
      if (s.timeline.length !== lastLen) {
        lastLen = s.timeline.length
        setTimeline([...s.timeline])
      }

      const box = wrap.current?.getBoundingClientRect()
      const w = Math.floor(box?.width ?? 900)
      const h = Math.floor((w * 5) / 9)
      const dpr = window.devicePixelRatio || 1
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr)
        el.height = Math.round(h * dpr)
        el.style.height = `${h}px`
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      render(ctx, s, tg, w, h)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === ' ') {
        e.preventDefault()
        doPunch()
        return
      }
      if (e.key === 'a' || e.key === 'A') {
        setToggles((tg) => (TOGGLE_IDS.every((id) => tg[id]) ? { ...ALL_OFF } : { ...ALL_ON }))
        return
      }
      const n = e.key === '0' ? 9 : Number(e.key) - 1
      if (Number.isInteger(n) && n >= 0 && n < TOGGLE_IDS.length) {
        const id = TOGGLE_IDS[n] as ToggleId
        setToggles((tg) => ({ ...tg, [id]: !tg[id] }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const allOn = TOGGLE_IDS.every((id) => toggles[id])
  const countOn = TOGGLE_IDS.filter((id) => toggles[id]).length

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <span className="wordmark">Wumms</span>
          <span className="claim">{t.claim}</span>
        </div>
        <div className="tools">
          <div className="seg" role="group" aria-label="Sprache / Language">
            {(['de', 'en'] as const).map((l) => (
              <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <a className="link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
            {t.source} ↗
          </a>
        </div>
      </header>

      <main className="layout">
        <section className="arena">
          <p className="intro">{t.intro}</p>
          <div className="stage" ref={wrap}>
            <canvas
              ref={canvas}
              role="img"
              aria-label="Fighter and training dummy"
              onPointerDown={doPunch}
            />
            <div className="stage-hud">
              <span className="hits">{t.hits(hits)}</span>
              <span className="hint">{t.hint}</span>
            </div>
          </div>
          <div className="controls">
            <button className="punch" onClick={doPunch}>
              {t.punch}
            </button>
            <div className="speed" role="group" aria-label={t.speed}>
              <span className="eyebrow">{t.speed}</span>
              <div className="seg">
                {SPEEDS.map((sp) => (
                  <button key={sp} aria-pressed={speed === sp} onClick={() => setSpeed(sp)}>
                    {sp === 1 ? t.speedFull : t.speedOf(sp)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Timeline events={timeline} hitstop={hitstopOn} t={t} />
          <p className="keys">{t.keys}</p>
        </section>

        <aside className="panel">
          <div className="panel-head">
            <span className="eyebrow">
              {countOn} / {TOGGLE_IDS.length}
            </span>
            <button
              className="small"
              onClick={() => setToggles(allOn ? { ...ALL_OFF } : { ...ALL_ON })}
            >
              {allOn ? t.allOff : t.allOn}
            </button>
          </div>
          <ol className="toggles">
            {TOGGLE_IDS.map((id, i) => (
              <li key={id}>
                <label className={`toggle${toggles[id] ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={toggles[id]}
                    onChange={(e) => setToggles((tg) => ({ ...tg, [id]: e.target.checked }))}
                  />
                  <span className="key" aria-hidden="true">
                    {(i + 1) % 10}
                  </span>
                  <span className="text">
                    <b>{t.toggles[id].name}</b>
                    <span>{t.toggles[id].what}</span>
                  </span>
                  <span className="switch" aria-hidden="true" />
                </label>
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </div>
  )
}

const SPAN_FROM = -150
const SPAN_TO = 650

function Timeline({
  events,
  hitstop,
  t,
}: {
  events: TimelineEvent[]
  hitstop: boolean
  t: Strings
}) {
  const x = (ms: number) => ((ms - SPAN_FROM) / (SPAN_TO - SPAN_FROM)) * 100
  const find = (kind: TimelineEvent['kind']) => events.find((e) => e.kind === kind)
  const windup = find('windup')
  const contact = find('contact')
  const shake = find('shake_settled')
  const dummy = find('dummy_settled')
  const open = Boolean(contact) && !(shake && dummy)

  const bar = (from: number, to: number, cls: string) => (
    <span
      className={`bar ${cls}`}
      style={{
        left: `${x(from)}%`,
        width: `${Math.max(0.6, x(Math.min(to, SPAN_TO)) - x(from))}%`,
      }}
    />
  )

  return (
    <section className="timeline" aria-label={t.timeline}>
      <h2 className="eyebrow">{t.timeline}</h2>
      {events.length === 0 ? (
        <p className="tl-empty">{t.timelineEmpty}</p>
      ) : (
        <div className="lanes">
          <div className="track">
            {[0, 100, 200, 300, 400, 500, 600].map((ms) => (
              <span key={ms} className="tick" style={{ left: `${x(ms)}%` }}>
                {ms === 0 ? t.contact : `${ms} ${t.ms}`}
              </span>
            ))}
            <span className="contact-line" style={{ left: `${x(0)}%` }} />
            <div className="lane">
              <span className="lane-name">{t.lanes.punch}</span>
              {windup && contact && bar(windup.t, 0, 'punch')}
              {contact && bar(0, TIMING.recover, 'recover')}
            </div>
            <div className="lane">
              <span className="lane-name">{t.lanes.hitstop}</span>
              {contact && hitstop && bar(0, TIMING.hitstop, 'hitstop')}
            </div>
            <div className="lane">
              <span className="lane-name">{t.lanes.shake}</span>
              {contact &&
                (shake ? bar(0, shake.t, 'shake') : open ? bar(0, SPAN_TO, 'shake open') : null)}
            </div>
            <div className="lane">
              <span className="lane-name">{t.lanes.dummy}</span>
              {contact &&
                (dummy ? bar(0, dummy.t, 'dummy') : open ? bar(0, SPAN_TO, 'dummy open') : null)}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
