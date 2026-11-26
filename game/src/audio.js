// Synthesised sound: engine hum, wind rush, ring chime, alarms. No audio
// files — everything is oscillators and filtered noise, built on first gesture
// (browsers block audio before the player interacts).

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSrc = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let alarmTimer = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      // Engine: two detuned saws through a low-pass, pitch follows throttle.
      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc1.frequency.value = 52;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 26;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc1.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc1.start();
      engineOsc2.start();

      // Wind: looped noise buffer through a band-pass.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 480;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSrc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    // Called every frame with the flight state.
    update(throttle, speed, flying) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const target = flying ? 0.05 + throttle * 0.11 : 0;
      engineGain.gain.setTargetAtTime(target, t, 0.1);
      const f = 46 + throttle * 58 + speed * 0.12;
      engineOsc1.frequency.setTargetAtTime(f, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
      const wind = flying ? Math.min(0.22, Math.max(0, (speed - 25) * 0.004)) : 0;
      windGain.gain.setTargetAtTime(wind, t, 0.15);
      windFilter.frequency.setTargetAtTime(380 + speed * 9, t, 0.2);
    },
    chime() {
      tone(660, 0.35, 'sine', 0.22);
      tone(990, 0.5, 'sine', 0.18, 0.09);
    },
    thud() {
      if (!ctx || muted) return;
      const t0 = ctx.currentTime;
      const src = ctx.createBufferSource();
      const len = Math.floor(ctx.sampleRate * 0.18);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 220;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t0);
    },
    alarm(on) {
      if (!ctx) return;
      if (on && !alarmTimer) {
        alarmTimer = setInterval(() => tone(880, 0.12, 'square', 0.07), 500);
      } else if (!on && alarmTimer) {
        clearInterval(alarmTimer);
        alarmTimer = null;
      }
    },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'triangle', 0.2, i * 0.13));
    },
  };
}
