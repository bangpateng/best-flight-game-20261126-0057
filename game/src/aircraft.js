// The aircraft: a low-poly island-hopper seaplane built from primitives.
// Forward is -Z, up is +Y. The group origin sits at the centre of lift.

import * as THREE from 'three';
import { COLORS } from './config.js';

function mat(color, roughness = 0.55, metalness = 0.15) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function buildAircraft() {
  const plane = new THREE.Group();
  const parts = {};

  // Fuselage: tapered tube + rounded nose.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.95, 4.8, 12), mat(COLORS.fuselage, 0.45, 0.1));
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, 0.4);
  plane.add(fuselage);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), mat(COLORS.fuselage, 0.45, 0.1));
  nose.scale.set(1, 1, 1.15);
  nose.position.set(0, 0, -2.0);
  plane.add(nose);

  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.18, 2.2, 10), mat(COLORS.fuselage, 0.5, 0.1));
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.set(0, 0.12, 3.85);
  plane.add(tailCone);

  // Orange cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.16, 4.4), mat(COLORS.stripeOrange, 0.5, 0.05));
  stripe.position.set(0, -0.18, 0.35);
  plane.add(stripe);

  // Canopy: tinted bubble over the cockpit.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.58, 16, 12),
    new THREE.MeshPhongMaterial({ color: COLORS.canopy, shininess: 140, specular: 0x99bbdd, transparent: true, opacity: 0.92 }),
  );
  canopy.scale.set(0.95, 0.72, 1.7);
  canopy.position.set(0, 0.52, -0.55);
  plane.add(canopy);

  // Main wing, slight dihedral, teal with cream tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.16, 1.55), mat(COLORS.wingTeal, 0.5, 0.2));
  wing.position.set(0, 0.12, -0.15);
  wing.rotation.z = 0;
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 1.5), mat(COLORS.fuselage, 0.5, 0.1));
    tip.position.set(side * 3.95, 0.12 + Math.abs(side) * 0.02, -0.15);
    tip.rotation.z = side * 0.06;
    plane.add(tip);
  }

  // Tailplane + fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 0.95), mat(COLORS.wingTeal, 0.5, 0.2));
  stab.position.set(0, 0.28, 4.55);
  plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.25, 1.15), mat(COLORS.wingTeal, 0.5, 0.2));
  fin.position.set(0, 0.75, 4.6);
  plane.add(fin);
  const finTip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 1.1), mat(COLORS.stripeOrange, 0.5, 0.05));
  finTip.position.set(0, 1.4, 4.6);
  plane.add(finTip);

  // Propeller: hub + two blades, spins with throttle.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -2.62);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 10), mat(COLORS.propDark, 0.4, 0.4));
  hub.rotation.x = -Math.PI / 2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.2, 2.7, 0.07);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a42, roughness: 0.4, metalness: 0.3, transparent: true, opacity: 0.9,
  });
  const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
  prop.add(blade1);
  const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade2);
  parts.blades = [blade1, blade2]; // hidden in cockpit view: a pilot sees a blur, not blades
  // Translucent disc that fades in at high rpm, so the prop reads as a blur.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.38, 24),
    new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  prop.add(disc);
  plane.add(prop);
  parts.prop = prop;
  parts.disc = disc;

  // Landing gear: two mains + nose wheel.
  const gearMat = mat(0x222226, 0.6, 0.4);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 6), gearMat);
    leg.position.set(side * 0.85, -0.85, -0.2);
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12), gearMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.85, -1.32, -0.2);
    plane.add(wheel);
  }
  const noseLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6), gearMat);
  noseLeg.position.set(0, -0.8, -1.9);
  plane.add(noseLeg);
  const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), gearMat);
  noseWheel.rotation.z = Math.PI / 2;
  noseWheel.position.set(0, -1.22, -1.9);
  plane.add(noseWheel);

  // Navigation lights: red port, green starboard, white tail.
  const navLights = [];
  const mkLight = (color, x, y, z) => {
    const l = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    l.position.set(x, y, z);
    plane.add(l);
    navLights.push(l);
  };
  mkLight(0xff2222, -4.25, 0.12, -0.15);
  mkLight(0x22ff66, 4.25, 0.12, -0.15);
  mkLight(0xffffff, 0, 0.35, 5.0);
  parts.navLights = navLights;

  // Cockpit dashboard: dark panel with three lit dials, seen from the cockpit
  // camera (and as a small detail in chase view). Kept low inside the fuselage.
  const dash = new THREE.Group();
  dash.position.set(0, 0.32, -1.55);
  dash.rotation.x = -0.22;
  plane.add(dash);
  const dashBody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 0.1), mat(0x22282e, 0.7, 0.1));
  dash.add(dashBody);
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 512;
  faceCanvas.height = 192;
  {
    const c = faceCanvas.getContext('2d');
    c.fillStyle = '#161b21';
    c.fillRect(0, 0, 512, 192);
    const dial = (cx, label, max, unit) => {
      c.save();
      c.translate(cx, 96);
      c.beginPath();
      c.arc(0, 0, 80, 0, Math.PI * 2);
      c.fillStyle = '#0d1116';
      c.fill();
      c.strokeStyle = '#3d4a56';
      c.lineWidth = 4;
      c.stroke();
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
        const major = i % 5 === 0;
        c.strokeStyle = major ? '#ffd34d' : '#8fa8bb';
        c.lineWidth = major ? 4 : 2;
        c.beginPath();
        c.moveTo(Math.cos(a) * 62, Math.sin(a) * 62);
        c.lineTo(Math.cos(a) * (major ? 48 : 55), Math.sin(a) * (major ? 48 : 55));
        c.stroke();
        if (major) {
          c.fillStyle = '#d7ecfa';
          c.font = 'bold 20px system-ui, sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(String(Math.round((i / 10) * max)), Math.cos(a) * 34, Math.sin(a) * 34);
        }
      }
      c.fillStyle = '#9fc3dd';
      c.font = 'bold 17px system-ui, sans-serif';
      c.fillText(label, 0, 58);
      c.font = '15px system-ui, sans-serif';
      c.fillText(unit, 0, -58);
      c.restore();
    };
    dial(88, 'KM/H', 320, 'SPEED');
    dial(424, 'M', 500, 'ALT');
    // Centre attitude dial: sky over ground, fixed lubber line.
    c.save();
    c.translate(256, 96);
    c.beginPath();
    c.arc(0, 0, 80, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#3f8fd2';
    c.fillRect(-80, -80, 160, 80);
    c.fillStyle = '#8a6a42';
    c.fillRect(-80, 0, 160, 80);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-80, 0);
    c.lineTo(80, 0);
    c.stroke();
    c.restore();
    c.strokeStyle = '#3d4a56';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(256, 96, 80, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#9fc3dd';
    c.font = 'bold 17px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('ATT', 256, 168);
  }
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.62, 0.58),
    new THREE.MeshBasicMaterial({ map: faceTex }),
  );
  face.position.z = 0.06;
  dash.add(face);

  const mkNeedle = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 0, 0.08);
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.01), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
    n.position.y = 0.15;
    g.add(n);
    const pin = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    pin.position.z = 0.01;
    g.add(pin);
    dash.add(g);
    return g;
  };
  // Face is 512 px wide for 1.62 m: dial centres sit at x = -0.53 / +0.53 m.
  parts.dashSpeed = mkNeedle(-0.53);
  parts.dashAlt = mkNeedle(0.53);

  // Attitude ball: a small disc that banks with the plane.
  const attCanvas = document.createElement('canvas');
  attCanvas.width = 128;
  attCanvas.height = 128;
  {
    const c = attCanvas.getContext('2d');
    c.fillStyle = '#3f8fd2';
    c.fillRect(0, 0, 128, 64);
    c.fillStyle = '#8a6a42';
    c.fillRect(0, 64, 128, 64);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(0, 64);
    c.lineTo(128, 64);
    c.stroke();
  }
  const attTex = new THREE.CanvasTexture(attCanvas);
  attTex.colorSpace = THREE.SRGBColorSpace;
  const attDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.19, 24),
    new THREE.MeshBasicMaterial({ map: attTex }),
  );
  attDisc.position.set(0, 0, 0.08);
  dash.add(attDisc);
  parts.dashAtt = attDisc;

  // Landing light under the nose, lit on the ground and on approach.
  const landingLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
  );
  landingLight.position.set(0, -0.45, -2.1);
  plane.add(landingLight);
  parts.landingLight = landingLight;

  plane.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  return { group: plane, parts };
}

// Spin the prop and fade the blur disc in with rpm; blink the nav lights.
export function animateAircraft(parts, throttle, dt, time) {
  const rpm = 4 + throttle * 42;
  parts.prop.rotation.z -= rpm * dt;
  parts.disc.material.opacity = Math.min(0.26, Math.max(0, (throttle - 0.25) * 0.5));
  const blink = Math.sin(time * 6) > 0;
  parts.navLights.forEach((l, i) => {
    l.visible = i === 2 ? blink : true;
  });
}

// Move the dashboard needles and bank the attitude ball with the plane.
export function updateDashboard(parts, flight) {
  if (!parts.dashSpeed) return;
  const speedKmh = flight.speed * 3.6;
  const speedAngle = THREE.MathUtils.lerp(2.1, -2.1, Math.min(1, Math.max(0, speedKmh / 320)));
  parts.dashSpeed.rotation.z = speedAngle;
  const altAngle = THREE.MathUtils.lerp(2.1, -2.1, Math.min(1, Math.max(0, flight.pos.y / 500)));
  parts.dashAlt.rotation.z = altAngle;
  parts.dashAtt.rotation.z = -flight.roll;
  parts.dashAtt.position.y = Math.max(-0.08, Math.min(0.08, flight.pitch * 0.16));
}
