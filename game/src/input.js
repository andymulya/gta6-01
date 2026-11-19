// Keyboard and pointer input. Held keys give the car's throttle, steering and
// handbrake; one-shot presses (enter/exit car, start, pause, buys, radio,
// save) are queued as bit flags and taken once by the loop, so a press between
// two frames is never lost and never counted twice. The mouse aims the gun
// on foot: pointer position is tracked, and a click fires (and confirms on
// title/game-over screens).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_BUY_ENGINE = 8;
export const ACTION_BUY_ARMOR = 16;
export const ACTION_BUY_TIRES = 32;
export const ACTION_BUY_SMG = 64;
export const ACTION_BUY_AMMO = 128;
export const ACTION_RADIO = 256;
export const ACTION_SAVE = 512;
export const ACTION_CONTINUE = 1024;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const HANDBRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const BUY_ENGINE = new Set(['Digit1', 'Numpad1']);
const BUY_ARMOR = new Set(['Digit2', 'Numpad2']);
const BUY_TIRES = new Set(['Digit3', 'Numpad3']);
const BUY_SMG = new Set(['Digit4', 'Numpad4']);
const BUY_AMMO = new Set(['Digit5', 'Numpad5']);
const RADIO = new Set(['KeyR']);
const SAVE = new Set(['KeyQ']);
const CONTINUE = new Set(['KeyC']);

export function createInput(target) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let handbrake = false;
  let actions = 0;
  let mouseX = 640;
  let mouseY = 360;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (HANDBRAKE.has(event.code)) {
      handbrake = true;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (BUY_ENGINE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BUY_ENGINE;
    } else if (BUY_ARMOR.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BUY_ARMOR;
    } else if (BUY_TIRES.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BUY_TIRES;
    } else if (BUY_SMG.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BUY_SMG;
    } else if (BUY_AMMO.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BUY_AMMO;
    } else if (RADIO.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RADIO;
    } else if (SAVE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SAVE;
    } else if (CONTINUE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONTINUE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (HANDBRAKE.has(event.code)) handbrake = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    handbrake = false;
    mouseDown = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    /** The held driving state, read fresh each frame. */
    state() {
      return { up, down, left, right, handbrake, action: false, mouseX, mouseY, mouseDown };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
