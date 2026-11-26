// Keyboard + mouse steering. Arrow keys / WASD fly the plane, Shift/Ctrl
// work the throttle, C swaps camera, Space brakes, P pauses, M mutes.
// Dragging on the canvas steers toward the pointer (mouse play).

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    pitch: 0, // -1..1, positive = pull up
    roll: 0, // -1..1, positive = bank right
    throttleDelta: 0,
    brake: false,
    mouseSteer: { active: false, x: 0, y: 0 },
  };
  let dragging = false;
  let dragX = 0;
  let dragY = 0;

  const onKeyDown = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    keys.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onBlur = () => keys.clear();

  const onPointerDown = (e) => {
    dragging = true;
    dragX = e.clientX;
    dragY = e.clientY;
    state.mouseSteer.active = true;
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    state.mouseSteer.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    state.mouseSteer.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  };
  const endDrag = () => {
    dragging = false;
    state.mouseSteer.active = false;
    state.mouseSteer.x = 0;
    state.mouseSteer.y = 0;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  function poll() {
    const up = keys.has('ArrowUp') || keys.has('KeyW');
    const down = keys.has('ArrowDown') || keys.has('KeyS');
    const left = keys.has('ArrowLeft') || keys.has('KeyA');
    const right = keys.has('ArrowRight') || keys.has('KeyD');
    let pitch = (up ? 1 : 0) - (down ? 1 : 0);
    let roll = (right ? 1 : 0) - (left ? 1 : 0);
    // Mouse drag steers gently toward the pointer: up = climb, right = bank.
    if (state.mouseSteer.active) {
      pitch += -state.mouseSteer.y * 0.9;
      roll += state.mouseSteer.x * 0.9;
    }
    state.pitch = Math.max(-1, Math.min(1, pitch));
    state.roll = Math.max(-1, Math.min(1, roll));
    const throttleUp = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyE');
    const throttleDown = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyQ');
    state.throttleDelta = (throttleUp ? 0.55 : 0) - (throttleDown ? 0.55 : 0);
    state.brake = keys.has('Space');
    return state;
  }

  // One-shot keys: returns true once per press.
  const pressed = new Set();
  function wasPressed(code) {
    if (keys.has(code) && !pressed.has(code)) {
      pressed.add(code);
      return true;
    }
    if (!keys.has(code)) pressed.delete(code);
    return false;
  }

  return { poll, wasPressed, keys, dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  } };
}
