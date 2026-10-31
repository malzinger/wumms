# Wumms

Game feel, one switch at a time. A fighter throws one punch at a training dummy, and ten switches turn the tricks on and off that make a hit feel like a hit.

**Live demo:** https://malzinger.github.io/wumms/

## The switches

| Switch           | What it does                                                                  |
| ---------------- | ----------------------------------------------------------------------------- |
| Anticipation     | A 120 ms pull-back before the strike instead of 25 ms                         |
| Squash & stretch | Fighter and dummy deform at the moment of impact                              |
| Hitstop          | The simulation freezes for 85 ms on contact; the camera keeps shaking         |
| Screen shake     | Trauma-based: offset grows with trauma², trauma decays linearly               |
| Sparks           | Sixteen particles with gravity and drag                                       |
| Flash            | White wash on the dummy and an expanding ring at the contact point            |
| Knockback        | The dummy is a damped spring on a base pivot; knockback adds angular velocity |
| Trail            | The fist leaves a fading smear while the punch is in flight                   |
| Punch zoom       | The camera zooms 6 % onto the impact and eases back                           |
| Sound            | Whoosh and thump synthesized with the Web Audio API, no samples               |

Slow motion (0.5×, 0.25×, 0.1×) makes the techniques visible one by one, and a frame timeline shows what happened on the last hit: wind-up, contact, hitstop, how long the shake lasted and when the dummy came to rest.

## Running it

```bash
npm install
npm run dev
```

The simulation (`src/game/sim.ts`) is a pure step function with a fixed 240 Hz step; the renderer draws it on a 2D canvas. `npm test` runs the Vitest suite: contact timing, hitstop freezing time, trauma decay, spring settling and particle lifetime. Switch state lives in the URL, so a specific combination can be linked.

## Stack

React 19, TypeScript (strict), Vite, Vitest, Canvas 2D, Web Audio. Space Grotesk and JetBrains Mono are served locally.

## License

MIT © Friedrich Malz
