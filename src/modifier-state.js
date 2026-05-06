const { Key } = require("@nut-tree-fork/nut-js");
const { UiohookKey } = require("uiohook-napi");

const { getEnabledHotkeyModifiers } = require("./shared");

const UIOHOOK_MODIFIER_KEYCODES = Object.freeze({
  control: [UiohookKey.Ctrl, UiohookKey.CtrlRight],
  alt: [UiohookKey.Alt, UiohookKey.AltRight],
  shift: [UiohookKey.Shift, UiohookKey.ShiftRight],
  super: [UiohookKey.Meta, UiohookKey.MetaRight],
});

function getNutMetaKeys(platform = process.platform) {
  if (platform === "darwin") {
    return [Key.LeftCmd, Key.RightCmd];
  }

  if (platform === "win32") {
    return [Key.LeftWin, Key.RightWin];
  }

  return [Key.LeftSuper, Key.RightSuper];
}

function createNutKeyByUiohookKeycode(platform = process.platform) {
  const [leftMetaKey, rightMetaKey] = getNutMetaKeys(platform);

  return new Map([
    [UiohookKey.Ctrl, Key.LeftControl],
    [UiohookKey.CtrlRight, Key.RightControl],
    [UiohookKey.Alt, Key.LeftAlt],
    [UiohookKey.AltRight, Key.RightAlt],
    [UiohookKey.Shift, Key.LeftShift],
    [UiohookKey.ShiftRight, Key.RightShift],
    [UiohookKey.Meta, leftMetaKey],
    [UiohookKey.MetaRight, rightMetaKey],
  ]);
}

function uniq(values) {
  return [...new Set(values)];
}

function isTrackedModifierKeycode(keycode) {
  return Object.values(UIOHOOK_MODIFIER_KEYCODES).some((keycodes) => keycodes.includes(keycode));
}

function createHotkeyModifierPlan(spec, pressedKeycodes = new Set()) {
  const releaseKeycodes = [];
  const restoreKeycodes = [];

  for (const modifier of getEnabledHotkeyModifiers(spec)) {
    const candidateKeycodes = UIOHOOK_MODIFIER_KEYCODES[modifier];
    const pressedCandidates = candidateKeycodes.filter((keycode) => pressedKeycodes.has(keycode));

    releaseKeycodes.push(...(pressedCandidates.length ? pressedCandidates : candidateKeycodes));
    restoreKeycodes.push(...pressedCandidates);
  }

  return {
    releaseKeycodes: uniq(releaseKeycodes),
    restoreKeycodes: uniq(restoreKeycodes),
  };
}

function getRestoreKeycodes(plan, pressedKeycodes = new Set()) {
  return plan.restoreKeycodes.filter((keycode) => pressedKeycodes.has(keycode));
}

function mapModifierKeycodesToNutKeys(keycodes, platform = process.platform) {
  const nutKeyByUiohookKeycode = createNutKeyByUiohookKeycode(platform);

  return uniq(keycodes.map((keycode) => nutKeyByUiohookKeycode.get(keycode)).filter(Boolean));
}

module.exports = {
  createHotkeyModifierPlan,
  getRestoreKeycodes,
  isTrackedModifierKeycode,
  mapModifierKeycodesToNutKeys,
  UIOHOOK_MODIFIER_KEYCODES,
};
