// A tiny WebAudio synth: engine hum tied to speed, a two-tone siren while the
// cops are on you, three procedural radio stations, and short blips for
// pickups, deliveries, crashes and gunshots. It is lazy and silent when audio
// is unavailable (headless runs, muted tabs): every call is guarded, and
// nothing throws.
export function createAudio() {
  let ctx = null;
  let engine = null;
  let engineGain = null;
  let siren = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let station = 0;
  let radioTimer = 0;
  let radioStep = 0;

  // Three stations, each a loop of (semitone offset from A2, beats). Synthwave:
  // minor arpeggio; funk: punchy roots; chill: slow major pads.
  const STATIONS = [
    [0, 1, 3, 1, 5, 1, 7, 1, 10, 1, 7, 1, 5, 1, 3, 1],
    [0, 0.5, 0, 0.5, 7, 0.5, 5, 0.5, 3, 0.5, 5, 0.5, 7, 0.5, 10, 0.5],
    [0, 2, 4, 2, 7, 2, 9, 2, 7, 2, 4, 2],
  ];
  const STATION_FREQ = [110, 98, 130.81];
  const STATION_TYPE = ['sawtooth', 'square', 'sine'];

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
    setStation(index) {
      station = index;
      radioStep = 0;
      radioTimer = 0;
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
        // Radio: step through the station's note loop.
        radioTimer -= dt;
        if (radioTimer <= 0) {
          const seq = STATIONS[station % STATIONS.length];
          const semis = seq[radioStep % seq.length];
          const beats = station === 1 ? 0.5 : station === 2 ? 2 : 1;
          radioTimer = 0.24 * beats;
          radioStep += 1;
          const freq = STATION_FREQ[station % STATION_FREQ.length] * Math.pow(2, semis / 12);
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = STATION_TYPE[station % STATION_TYPE.length];
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.035, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22 * beats);
          o.connect(g);
          g.connect(ctx.destination);
          o.start();
          o.stop(ctx.currentTime + 0.22 * beats);
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
    shoot() {
      blip(1400, 0.08, 'square', 0.1);
      blip(300, 0.1, 'sawtooth', 0.08);
    },
    busted() {
      blip(220, 0.5, 'square', 0.1);
    },
  };
}
