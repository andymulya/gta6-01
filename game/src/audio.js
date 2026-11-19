// A tiny WebAudio synth: engine hum tied to speed, a two-tone siren while the
// cops are on you, and short blips for pickups, deliveries and crashes. It is
// lazy and silent when audio is unavailable (headless runs, muted tabs): every
// call is guarded, and nothing throws.
export function createAudio() {
  let ctx = null;
  let engine = null;
  let engineGain = null;
  let siren = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engine = ctx.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engine.connect(engineGain);
      engineGain.connect(ctx.destination);
      engine.start();
      siren = ctx.createOscillator();
      siren.type = 'square';
      siren.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      siren.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      siren.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, seconds, type, volume) {
    if (!ensure()) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(volume || 0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + seconds);
    } catch {
      // Silence is fine.
    }
  }

  return {
    /** Call once on the first user gesture; also safe to call any time. */
    unlock() {
      ensure();
    },
    /** Continuous sounds, driven by the world each frame. */
    update(state, dt) {
      if (!ctx) return;
      try {
        if (ctx.state === 'suspended') return;
        const speed = Math.hypot(state.playerCar.vx, state.playerCar.vy);
        engine.frequency.value = 55 + speed * 0.22;
        engineGain.gain.value = state.player.inCar ? 0.028 : 0;
        const wanted = state.wanted;
        if (wanted > 0) {
          sirenTimer -= dt;
          if (sirenTimer <= 0) {
            sirenHigh = !sirenHigh;
            siren.frequency.value = sirenHigh ? 880 : 660;
            sirenTimer = 0.45;
          }
          sirenGain.gain.value = 0.02;
        } else {
          sirenGain.gain.value = 0;
        }
      } catch {
        // Silence is fine.
      }
    },
    pickup() {
      blip(880, 0.18, 'sine', 0.14);
      setTimeout(() => blip(1320, 0.22, 'sine', 0.12), 90);
    },
    deliver() {
      blip(660, 0.15, 'triangle', 0.14);
      setTimeout(() => blip(990, 0.25, 'triangle', 0.14), 110);
    },
    crash() {
      blip(90, 0.25, 'sawtooth', 0.16);
    },
    busted() {
      blip(220, 0.5, 'square', 0.1);
    },
  };
}
