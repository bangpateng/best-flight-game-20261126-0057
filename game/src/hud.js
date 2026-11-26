// Heads-up display: altitude, speed, heading compass, artificial horizon,
// throttle + fuel, rings, timer, score, damage and a minimap. All DOM + two
// small canvases, updated from the flight state every frame.

import { clamp } from './random.js';
import { terrainHeight } from './terrain.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    alt: $('hud-alt'),
    spd: $('hud-spd'),
    hdg: $('hud-hdg'),
    compass: $('hud-compass'),
    attitude: $('hud-attitude'),
    throttleFill: $('hud-throttle-fill'),
    throttleVal: $('hud-throttle-val'),
    fuelFill: $('hud-fuel-fill'),
    fuelVal: $('hud-fuel-val'),
    rings: $('hud-rings'),
    timer: $('hud-timer'),
    score: $('hud-score'),
    damageFill: $('hud-damage-fill'),
    mission: $('hud-mission'),
    toast: $('hud-toast'),
    minimap: $('hud-minimap'),
    stall: $('hud-stall'),
    lowFuel: $('hud-lowfuel'),
  };
  const compassCtx = el.compass.getContext('2d');
  const attCtx = el.attitude.getContext('2d');
  const mapCtx = el.minimap.getContext('2d');

  // Pre-render the island shape once for the minimap.
  const mapBase = document.createElement('canvas');
  mapBase.width = 140;
  mapBase.height = 140;
  {
    const b = mapBase.getContext('2d');
    b.fillStyle = '#0d2b45';
    b.fillRect(0, 0, 140, 140);
    const img = b.createImageData(140, 140);
    for (let py = 0; py < 140; py++) {
      for (let px = 0; px < 140; px++) {
        const wx = (px / 140 - 0.5) * 4200;
        const wz = (py / 140 - 0.5) * 4200;
        const h = terrainHeight(wx, wz);
        const i = (py * 140 + px) * 4;
        if (h > 1) {
          const g = h > 180 ? [110, 105, 95] : [52, 122, 62];
          img.data[i] = g[0];
          img.data[i + 1] = g[1];
          img.data[i + 2] = g[2];
        } else {
          img.data[i] = 26;
          img.data[i + 1] = 92;
          img.data[i + 2] = 128;
        }
        img.data[i + 3] = 255;
      }
    }
    b.putImageData(img, 0, 0);
    // Runway tick.
    b.fillStyle = '#f5f5ee';
    b.fillRect(68, 96, 4, 34);
  }

  let toastTimer = null;
  function toast(text, ms = 2600) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function drawCompass(headingDeg) {
    const w = 240;
    const h = 30;
    const c = compassCtx;
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(8, 20, 32, 0.55)';
    c.fillRect(0, 0, w, h);
    const pxPerDeg = w / 120; // show +-60 deg around the heading
    c.font = 'bold 13px system-ui, sans-serif';
    c.textAlign = 'center';
    for (let d = -60; d <= 60; d += 15) {
      let deg = Math.round(headingDeg + d);
      deg = ((deg % 360) + 360) % 360;
      const x = w / 2 + d * pxPerDeg;
      const major = deg % 90 === 0;
      c.strokeStyle = major ? '#ffd34d' : '#9fc3dd';
      c.lineWidth = major ? 2 : 1;
      c.beginPath();
      c.moveTo(x, major ? 4 : 10);
      c.lineTo(x, 18);
      c.stroke();
      if (major || deg % 30 === 0) {
        const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg);
        c.fillStyle = major ? '#ffd34d' : '#d7ecfa';
        c.fillText(label, x, 28);
      }
    }
    // Centre caret.
    c.fillStyle = '#ffd34d';
    c.beginPath();
    c.moveTo(w / 2 - 6, 0);
    c.lineTo(w / 2 + 6, 0);
    c.lineTo(w / 2, 7);
    c.closePath();
    c.fill();
  }

  function drawAttitude(pitch, roll) {
    const s = 120;
    const c = attCtx;
    c.clearRect(0, 0, s, s);
    c.save();
    c.beginPath();
    c.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
    c.clip();
    c.translate(s / 2, s / 2);
    c.rotate(-roll);
    const yOff = clamp(pitch, -0.6, 0.6) * 70;
    c.fillStyle = '#3f8fd2';
    c.fillRect(-s, -s + yOff, s * 2, s);
    c.fillStyle = '#8a6a42';
    c.fillRect(-s, yOff, s * 2, s);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-s, yOff);
    c.lineTo(s, yOff);
    c.stroke();
    c.restore();
    // Fixed wings marker.
    c.strokeStyle = '#ffd34d';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(s / 2 - 26, s / 2);
    c.lineTo(s / 2 - 8, s / 2);
    c.moveTo(s / 2 + 8, s / 2);
    c.lineTo(s / 2 + 26, s / 2);
    c.stroke();
    c.beginPath();
    c.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 1.5;
    c.stroke();
  }

  let mapTick = 0;
  function drawMinimap(plane, rings, nextRing) {
    const tick = mapTick++;
    if (tick % 6 !== 0) return; // ~10 Hz is plenty (first call draws at once)
    const c = mapCtx;
    c.clearRect(0, 0, 140, 140);
    c.drawImage(mapBase, 0, 0);
    const toMap = (x, z) => [70 + (x / 4200) * 140, 70 + (z / 4200) * 140];
    rings.forEach((r, i) => {
      const [mx, mz] = toMap(r.x, r.z);
      c.beginPath();
      c.arc(mx, mz, i === nextRing ? 6 : 3.5, 0, Math.PI * 2);
      c.fillStyle = i < nextRing ? '#37d67a' : i === nextRing ? '#ff8c1a' : '#3fa7ff';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 1;
      c.stroke();
    });
    const [px, pz] = toMap(plane.pos.x, plane.pos.z);
    const hdg = (plane.headingDeg * Math.PI) / 180;
    c.save();
    c.translate(px, pz);
    c.rotate(hdg);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -7);
    c.lineTo(5, 6);
    c.lineTo(0, 3);
    c.lineTo(-5, 6);
    c.closePath();
    c.fill();
    c.restore();
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  return {
    toast,
    setMission(name) {
      el.mission.textContent = name;
    },
    update(f) {
      // f: {flight, mission, score, ringsDone, ringsTotal, timeLeft, fuel, damage, nextRing}
      const fl = f.flight;
      el.alt.textContent = `${Math.max(0, Math.round(fl.pos.y))} m`;
      el.spd.textContent = `${Math.round(fl.speed * 3.6)} km/h`;
      el.hdg.textContent = `${String(Math.round(fl.headingDeg)).padStart(3, '0')}°`;
      drawCompass(fl.headingDeg);
      drawAttitude(fl.pitch, fl.roll);
      el.throttleFill.style.width = `${Math.round(fl.throttle * 100)}%`;
      el.throttleVal.textContent = `${Math.round(fl.throttle * 100)}%`;
      const fuelPct = clamp(f.fuel, 0, 100);
      el.fuelFill.style.width = `${fuelPct}%`;
      el.fuelFill.classList.toggle('low', fuelPct < 25);
      el.fuelVal.textContent = `${Math.round(fuelPct)}%`;
      el.rings.textContent = `${f.ringsDone}/${f.ringsTotal}`;
      el.timer.textContent = fmtTime(f.timeLeft);
      el.timer.classList.toggle('urgent', f.timeLeft < 30);
      el.score.textContent = String(f.score);
      el.damageFill.style.width = `${clamp(f.damage, 0, 100)}%`;
      el.stall.classList.toggle('show', fl.stalled);
      el.lowFuel.classList.toggle('show', fuelPct < 20 && fuelPct > 0);
      drawMinimap(fl, f.ringPositions, f.nextRing);
    },
  };
}
