const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createHotkeyModifierPlan,
  getRestoreKeycodes,
  isTrackedModifierKeycode,
  mapModifierKeycodesToNutKeys,
} = require("../src/modifier-state");
const UiohookKey = require("../src/uiohook-keycodes");

const nutKeys = Object.freeze({
  LeftAlt: "LeftAlt",
  LeftControl: "LeftControl",
  LeftShift: "LeftShift",
  LeftSuper: "LeftSuper",
  RightAlt: "RightAlt",
  RightControl: "RightControl",
  RightShift: "RightShift",
  RightSuper: "RightSuper",
  LeftCmd: "LeftCmd",
  RightCmd: "RightCmd",
  LeftWin: "LeftWin",
  RightWin: "RightWin",
});

test("createHotkeyModifierPlan prefers the exact pressed modifier side", () => {
  const plan = createHotkeyModifierPlan({
    key: "a",
    modifiers: {
      control: true,
      shift: true,
    },
  }, new Set([UiohookKey.CtrlRight, UiohookKey.Shift]));

  assert.deepEqual(plan, {
    releaseKeycodes: [UiohookKey.CtrlRight, UiohookKey.Shift],
    restoreKeycodes: [UiohookKey.CtrlRight, UiohookKey.Shift],
  });
});

test("createHotkeyModifierPlan falls back to both modifier sides when state is unknown", () => {
  const plan = createHotkeyModifierPlan({
    key: "a",
    modifiers: {
      alt: true,
    },
  }, new Set());

  assert.deepEqual(plan, {
    releaseKeycodes: [UiohookKey.Alt, UiohookKey.AltRight],
    restoreKeycodes: [],
  });
});

test("getRestoreKeycodes only keeps modifiers still physically held", () => {
  const restoreKeycodes = getRestoreKeycodes({
    restoreKeycodes: [UiohookKey.Ctrl, UiohookKey.ShiftRight],
  }, new Set([UiohookKey.ShiftRight]));

  assert.deepEqual(restoreKeycodes, [UiohookKey.ShiftRight]);
});

test("mapModifierKeycodesToNutKeys maps tracked modifiers to nut keys", () => {
  assert.deepEqual(
    mapModifierKeycodesToNutKeys([UiohookKey.CtrlRight, UiohookKey.Shift], process.platform, nutKeys),
    [nutKeys.RightControl, nutKeys.LeftShift],
  );
});

test("isTrackedModifierKeycode identifies tracked hotkey modifiers", () => {
  assert.equal(isTrackedModifierKeycode(UiohookKey.MetaRight), true);
  assert.equal(isTrackedModifierKeycode(UiohookKey.A), false);
});
