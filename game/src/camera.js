// Camera rigs: a smoothed chase camera behind the plane and a cockpit camera
// from the pilot's seat, looking over the nose and the instrument panel.

import * as THREE from 'three';
import { forwardVector } from './physics.js';
import { clamp, dampFactor } from './random.js';

export function createCameraRig(camera, planeGroup) {
  const _fwd = new THREE.Vector3();
  const _desired = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const _planePos = new THREE.Vector3();
  const _offset = new THREE.Vector3();
  let shake = 0;

  return {
    addShake(amount) {
      shake = Math.min(1.2, shake + amount);
    },
    updateChase(flight, dt, time, snap = false) {
      forwardVector(flight.yaw, flight.pitch, _fwd);
      planeGroup.getWorldPosition(_planePos);
      // Chase position: behind and above, in the plane's own frame.
      _offset.copy(_fwd).multiplyScalar(-15);
      _offset.y += 4.6;
      _desired.copy(_planePos).add(_offset);
      // Keep the camera out of the sea and the hills.
      if (_desired.y < 4) _desired.y = 4;
      const k = snap ? 1 : dampFactor(4.5, dt);
      camera.position.lerp(_desired, k);
      _look.copy(_planePos).addScaledVector(_fwd, 22);
      _look.y += 1;
      camera.lookAt(_look);
      camera.rotation.z += flight.roll * 0.22; // lean with the bank
      if (shake > 0.001) {
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        shake *= Math.max(0, 1 - 3 * dt);
      }
      camera.fov = 62 + clamp((flight.speed - 30) / 60, 0, 1) * 8;
      camera.updateProjectionMatrix();
    },
    updateCockpit(flight, dt, time) {
      forwardVector(flight.yaw, flight.pitch, _fwd);
      planeGroup.getWorldPosition(_planePos);
      // Pilot's eye, just above the canopy line.
      _offset.copy(_fwd).multiplyScalar(0.4);
      _offset.y += 1.05;
      camera.position.copy(_planePos).add(_offset);
      _look.copy(_planePos).addScaledVector(_fwd, 60);
      _look.y += 0.4;
      camera.lookAt(_look);
      camera.rotation.z += flight.roll * 0.1;
      if (shake > 0.001) {
        camera.position.x += (Math.random() - 0.5) * shake * 0.6;
        camera.position.y += (Math.random() - 0.5) * shake * 0.6;
        shake *= Math.max(0, 1 - 3 * dt);
      }
      camera.fov = 70;
      camera.updateProjectionMatrix();
    },
  };
}
