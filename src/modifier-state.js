const { getEnabledHotkeyModifiers } = require("./shared");
const UiohookKey = require("./uiohook-keycodes");

let cachedNutKeys;

const UIOHOOK_MODIFIER_KEYCODES = Object.freeze({
  control: [UiohookKey.Ctrl, UiohookKey.CtrlRight],
  alt: [UiohookKey.Alt, UiohookKey.AltRight],
  shift: [UiohookKey.Shift, UiohookKey.ShiftRight],
  super: [UiohookKey.Meta, UiohookKey.MetaRight],
});

function getNutKeys() {
  if (cachedNutKeys === undefined) {
    cachedNutKeys = require("@nut-tree-fork/nut-js").Key;
  }

  return cachedNutKeys;
}

function getNutMetaKeys(nutKeys, platform = process.platform) {
  if (platform === "darwin") {
    return [nutKeys.LeftCmd, nutKeys.RightCmd];
  }

  if (platform === "win32") {
    return [nutKeys.LeftWin, nutKeys.RightWin];
  }

  return [nutKeys.LeftSuper, nutKeys.RightSuper];
}

function createNutKeyByUiohookKeycode(nutKeys, platform = process.platform) {
  const [leftMetaKey, rightMetaKey] = getNutMetaKeys(nutKeys, platform);

  return new Map([
    [UiohookKey.Ctrl, nutKeys.LeftControl],
    [UiohookKey.CtrlRight, nutKeys.RightControl],
    [UiohookKey.Alt, nutKeys.LeftAlt],
    [UiohookKey.AltRight, nutKeys.RightAlt],
    [UiohookKey.Shift, nutKeys.LeftShift],
    [UiohookKey.ShiftRight, nutKeys.RightShift],
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

function mapModifierKeycodesToNutKeys(keycodes, {
  platform = process.platform,
  nutKeys,
} = {}) {
  const nutKeyByUiohookKeycode = createNutKeyByUiohookKeycode(nutKeys ?? getNutKeys(), platform);

  return uniq(keycodes.map((keycode) => nutKeyByUiohookKeycode.get(keycode)).filter(Boolean));
}

module.exports = {
  createHotkeyModifierPlan,
  getRestoreKeycodes,
  isTrackedModifierKeycode,
  mapModifierKeycodesToNutKeys,
  UIOHOOK_MODIFIER_KEYCODES,
};
