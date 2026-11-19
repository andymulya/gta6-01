// Keyboard and pointer input. Held keys give movement and driving; one-shot presses
// (enter car, punch, save, pause, confirm, new game, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost or counted twice.
// Mouse clicks aim the pistol: the click point is kept in screen pixels and converted
// to world coordinates by the caller.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SAVE = 16;
export const ACTION_NEWGAME = 32;
export const ACTION_MUTE = 64;
export const ACTION_SHOOT = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const PUNCH = new Set(['Space']);
const SAVE = new Set(['KeyQ']);
const NEWGAME = new Set(['KeyC']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let clickX = 0;
  let clickY = 0;

  function keydown(event) {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER_CAR.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (SAVE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SAVE;
    } else if (NEWGAME.has(event.code)) {
      if (!event.repeat) actions |= ACTION_NEWGAME;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  }

  function keyup(event) {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
  }

  // A key released while the tab is hidden never sends keyup: let go on blur.
  function blur() {
    held.up = held.down = held.left = held.right = false;
  }

  function pointerdown(event) {
    const rect = target.getBoundingClientRect();
    clickX = event.clientX - rect.left;
    clickY = event.clientY - rect.top;
    actions |= ACTION_SHOOT;
  }

  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', blur);
  target.addEventListener('pointerdown', pointerdown);

  return {
    /** Movement vector from held keys, normalised: {x, y} each in [-1, 1]. */
    move() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x !== 0 && y !== 0) {
        const s = Math.SQRT1_2;
        return { x: x * s, y: y * s };
      }
      return { x, y };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Last click point in canvas CSS pixels. */
    click() {
      return { x: clickX, y: clickY };
    },
    /** Release every held key (used when the game is paused or the tab hides). */
    releaseAll() {
      held.up = held.down = held.left = held.right = false;
    },
  };
}
