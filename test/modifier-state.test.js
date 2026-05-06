const test = require("node:test");
const assert = require("node:assert/strict");

const { Key } = require("@nut-tree-fork/nut-js");

const { getHotkeyModifierReleaseKeys } = require("../src/modifier-state");

test("getHotkeyModifierReleaseKeys releases both sides for enabled modifiers", () => {
  assert.deepEqual(getHotkeyModifierReleaseKeys({
    key: "a",
    modifiers: {
      control: true,
      shift: true,
    },
  }), [Key.LeftControl, Key.RightControl, Key.LeftShift, Key.RightShift]);
});

test("getHotkeyModifierReleaseKeys maps super to the platform meta keys", () => {
  assert.deepEqual(getHotkeyModifierReleaseKeys({
    key: "a",
    modifiers: {
      super: true,
    },
  }, "darwin"), [Key.LeftCmd, Key.RightCmd]);
});

test("getHotkeyModifierReleaseKeys maps super to Windows keys outside macOS", () => {
  assert.deepEqual(getHotkeyModifierReleaseKeys({
    key: "a",
    modifiers: {
      super: true,
    },
  }, "win32"), [Key.LeftWin, Key.RightWin]);
});
