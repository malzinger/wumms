import type { ToggleId } from '../game/sim'

export type Lang = 'de' | 'en'

export function detectLang(): Lang {
  const param = new URLSearchParams(location.search).get('lang')
  if (param === 'de' || param === 'en') return param
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'
}

interface ToggleText {
  name: string
  what: string
}

const de = {
  claim: 'Game Feel, Schalter für Schalter.',
  intro:
    'Ein Schlag auf eine Puppe. Jeder Schalter rechts ist ein Trick, mit dem Spiele einen Treffer spürbar machen. Erst alles aus, dann einzeln dazuschalten.',
  punch: 'Schlagen',
  hint: 'Leertaste oder Klick auf die Bühne',
  hits: (n: number) => `${n} Treffer`,
  allOn: 'Alles an',
  allOff: 'Alles aus',
  speed: 'Zeitlupe',
  speedFull: 'Echtzeit',
  speedOf: (f: number) => `${f.toFixed(2).replace('.', ',')}×`,
  timeline: 'Was beim letzten Treffer passiert ist',
  timelineEmpty: 'Noch kein Treffer. Leertaste drücken.',
  lanes: { punch: 'Schlag', hitstop: 'Hitstop', shake: 'Shake', dummy: 'Puppe' },
  contact: 'Treffer',
  ms: 'ms',
  toggles: {
    anticipation: {
      name: 'Ausholen',
      what: 'Ein kurzes Zurücknehmen vor dem Schlag kündigt ihn an. Ohne Ausholen wirkt er wie aus dem Nichts.',
    },
    squash: {
      name: 'Squash & Stretch',
      what: 'Kämpfer und Puppe verformen sich im Moment des Treffers, wie im Zeichentrick.',
    },
    hitstop: {
      name: 'Hitstop',
      what: 'Das Bild friert beim Treffer für 85 Millisekunden ein. Die Pause liest das Auge als Wucht.',
    },
    shake: {
      name: 'Kamerashake',
      what: 'Die Kamera zittert mit abklingendem „Trauma“, nicht mit zufälligem Wackeln.',
    },
    particles: {
      name: 'Funken',
      what: 'Sechzehn Partikel fliegen aus dem Treffer und fallen mit Schwerkraft.',
    },
    flash: {
      name: 'Aufblitzen',
      what: 'Die Puppe blitzt weiß auf, ein Ring breitet sich vom Treffer aus.',
    },
    knockback: {
      name: 'Rückstoß',
      what: 'Die Puppe kippt weit zurück und federt aus, statt nur zu zucken.',
    },
    trail: {
      name: 'Schweif',
      what: 'Die Faust zieht eine kurze Spur und macht die Bewegung lesbar.',
    },
    zoom: {
      name: 'Punch-Zoom',
      what: 'Die Kamera zoomt für einen Augenblick auf den Treffer.',
    },
    sound: {
      name: 'Ton',
      what: 'Whoosh beim Schlag, Wumms beim Treffer, im Browser synthetisiert.',
    },
  } satisfies Record<ToggleId, ToggleText>,
  source: 'Quellcode',
  keys: 'Leertaste: Schlag · 1 bis 0: Schalter · A: alles an/aus',
}

export type Strings = typeof de

const en: Strings = {
  claim: 'Game feel, one switch at a time.',
  intro:
    'One punch on a training dummy. Every switch on the right is a trick games use to make a hit feel like something. Start with everything off, then add one at a time.',
  punch: 'Punch',
  hint: 'Space, or click the stage',
  hits: (n: number) => `${n} ${n === 1 ? 'hit' : 'hits'}`,
  allOn: 'All on',
  allOff: 'All off',
  speed: 'Slow motion',
  speedFull: 'Real time',
  speedOf: (f: number) => `${f.toFixed(2)}×`,
  timeline: 'What happened on the last hit',
  timelineEmpty: 'No hit yet. Press space.',
  lanes: { punch: 'Punch', hitstop: 'Hitstop', shake: 'Shake', dummy: 'Dummy' },
  contact: 'Contact',
  ms: 'ms',
  toggles: {
    anticipation: {
      name: 'Anticipation',
      what: 'A short pull-back before the punch announces it. Without it the hit comes out of nowhere.',
    },
    squash: {
      name: 'Squash & stretch',
      what: 'Fighter and dummy deform at the moment of impact, cartoon style.',
    },
    hitstop: {
      name: 'Hitstop',
      what: 'The frame freezes for 85 milliseconds on contact. The eye reads the pause as weight.',
    },
    shake: {
      name: 'Screen shake',
      what: 'The camera shakes with decaying "trauma" instead of random jitter.',
    },
    particles: {
      name: 'Sparks',
      what: 'Sixteen particles burst from the hit and fall under gravity.',
    },
    flash: {
      name: 'Flash',
      what: 'The dummy flashes white and a ring expands from the point of contact.',
    },
    knockback: {
      name: 'Knockback',
      what: 'The dummy tips far back and springs out instead of twitching.',
    },
    trail: {
      name: 'Trail',
      what: 'The fist leaves a short smear that makes the motion readable.',
    },
    zoom: {
      name: 'Punch zoom',
      what: 'The camera zooms onto the hit for an instant.',
    },
    sound: {
      name: 'Sound',
      what: 'Whoosh on the swing, thump on the hit, synthesized in the browser.',
    },
  },
  source: 'Source',
  keys: 'Space: punch · 1 to 0: switches · A: all on/off',
}

export const STRINGS: Record<Lang, Strings> = { de, en }
