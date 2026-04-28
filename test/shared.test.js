const test = require("node:test");
const assert = require("node:assert/strict");

const {
  clampDelay,
  createAcceleratorFromSpec,
  formatHotkeyLabel,
  DEFAULT_SETTINGS,
  normalizeBarcodeValue,
  normalizeHotkeySpec,
} = require("../src/shared");

test("normalizeBarcodeValue preserves supported characters", () => {
  assert.equal(normalizeBarcodeValue("AbC123-_=+[]{}\\|;:'\",.<>/?"), "AbC123-_=+[]{}\\|;:'\",.<>/?");
});

test("normalizeBarcodeValue replaces unsupported characters with question marks", () => {
  assert.equal(normalizeBarcodeValue("hello мир"), "hello????");
});

test("clampDelay keeps values inside the supported range", () => {
  assert.equal(clampDelay(1), 10);
  assert.equal(clampDelay(42), 42);
  assert.equal(clampDelay(999), 100);
});

test("hotkey helpers create platform labels and accelerators", () => {
  const hotkey = normalizeHotkeySpec({
    key: "a",
    modifiers: {
      control: true,
      alt: true,
      super: true,
    },
  });

  assert.equal(
    createAcceleratorFromSpec(hotkey),
    process.platform === "darwin" ? "Control+Alt+Command+A" : "Control+Alt+Super+A",
  );
  assert.equal(formatHotkeyLabel(hotkey, "linux"), "Ctrl + Alt + Win + A");
  assert.equal(formatHotkeyLabel(hotkey, "darwin"), "Control + Option + Command + A");
});

test("default hotkey remains Ctrl+Alt+A", () => {
  const hotkey = normalizeHotkeySpec(DEFAULT_SETTINGS.hotkey);

  assert.deepEqual(hotkey, {
    key: "A",
    modifiers: {
      control: true,
      alt: true,
      shift: false,
      super: false,
    },
  });
  assert.equal(createAcceleratorFromSpec(hotkey), "Control+Alt+A");
  assert.equal(formatHotkeyLabel(hotkey, "linux"), "Ctrl + Alt + A");
});

test("default speed remains 10 ms", () => {
  assert.equal(DEFAULT_SETTINGS.delayMs, 10);
});

test("hotkey requires at least one modifier", () => {
  assert.throws(() => normalizeHotkeySpec({ key: "A", modifiers: {} }), /at least one modifier/i);
});
