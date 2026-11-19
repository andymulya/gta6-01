// Synthesised sound, no audio files: a low engine hum that follows speed, a
// two-tone police siren, a gunshot noise burst, a cash jingle and a quiet pad loop.
// Everything is guarded: if the browser has no AudioContext (or it stays suspended)
// the game simply plays silent.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let padOsc = null;
  let padGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return ctx !== null;
    started = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a square wave that alternates between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      // Pad: two detuned triangles, very quiet, for atmosphere.
      padOsc = ctx.createOscillator();
      padOsc.type = 'triangle';
      padOsc.frequency.value = 110;
      padGain = ctx.createGain();
      padGain.gain.value = 0.02;
      padOsc.connect(padGain);
      padGain.connect(master);
      padOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  /** Call on the first user gesture (Enter / click). */
  function unlock() {
    if (ensure()) resume();
  }

  /** speedNorm 0..1 (0 = parked / on foot), wanted 0..5. */
  function update(speedNorm, wanted) {
    if (!ctx) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(speedNorm > 0.02 ? 0.05 + speedNorm * 0.05 : 0, t, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + speedNorm * 90, t, 0.1);
    if (wanted > 0) {
      sirenTimer += 1 / 60;
      const high = Math.floor(sirenTimer * 1.6) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(high ? 740 : 560, t, 0.05);
      sirenGain.gain.setTargetAtTime(0.035, t, 0.2);
    } else {
      sirenGain.gain.setTargetAtTime(0, t, 0.2);
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Sound is decorative; never let it break the game.
    }
  }

  function gunshot() {
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      src.connect(gain);
      gain.connect(master);
      src.start(t);
    } catch {
      // Ignore.
    }
  }

  /** Cash jingle: a rising three-note arpeggio. */
  function jingle() {
    blip(660, 0.12, 'sine', 0.16, 0);
    blip(880, 0.12, 'sine', 0.16, 0.09);
    blip(1320, 0.2, 'sine', 0.16, 0.18);
  }

  function thud() {
    blip(90, 0.15, 'sine', 0.2, 0);
  }

  function setMuted(value) {
    muted = value;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
  }

  return { unlock, update, gunshot, jingle, thud, setMuted, get muted() { return muted; } };
}
