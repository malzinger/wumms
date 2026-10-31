/** Punch sounds synthesized on the fly: no samples, nothing to load. */
export class Synth {
  private ctx: AudioContext | null = null

  /** Must first be reached from a user gesture, or the browser keeps the context suspended. */
  private get audio(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  /** Air moving: a short band-passed noise sweep. */
  whoosh(): void {
    const ac = this.audio
    const t = ac.currentTime
    const src = ac.createBufferSource()
    src.buffer = this.noise(ac, 0.18)
    const filter = ac.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 1.2
    filter.frequency.setValueAtTime(400, t)
    filter.frequency.exponentialRampToValueAtTime(1800, t + 0.12)
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    src.connect(filter).connect(gain).connect(ac.destination)
    src.start(t)
  }

  /** Impact: a low sine thump plus a crack of filtered noise. */
  hit(): void {
    const ac = this.audio
    const t = ac.currentTime

    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(170, t)
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.13)
    const og = ac.createGain()
    og.gain.setValueAtTime(0.9, t)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(og).connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.25)

    const src = ac.createBufferSource()
    src.buffer = this.noise(ac, 0.09)
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1200
    const ng = ac.createGain()
    ng.gain.setValueAtTime(0.5, t)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    src.connect(hp).connect(ng).connect(ac.destination)
    src.start(t)
  }

  private noise(ac: AudioContext, seconds: number): AudioBuffer {
    const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }
}
