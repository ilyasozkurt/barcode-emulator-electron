const HOTKEY_KEYS = Object.freeze([
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
]);

const SUPPORTED_BARCODE_CHAR = /^[0-9A-Za-z`~!@#$%^&*()_+\-=\[\]{}\\|;:'",.<>/?]$/;

const DEFAULT_SETTINGS = Object.freeze({
  barcodeValue: "test",
  delayMs: 10,
  sendEnter: false,
  hotkey: {
    key: "A",
    modifiers: {
      control: true,
      alt: true,
      shift: false,
      super: false,
    },
  },
});

function hasHotkeyModifier(modifiers = {}) {
  return Boolean(modifiers.control || modifiers.alt || modifiers.shift || modifiers.super);
}

function normalizeBarcodeValue(value) {
  return [...String(value ?? "")].map((character) => {
    return SUPPORTED_BARCODE_CHAR.test(character) ? character : "?";
  }).join("");
}

function clampDelay(delayMs) {
  const parsed = Number(delayMs);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SETTINGS.delayMs;
  }

  return Math.min(100, Math.max(10, Math.round(parsed)));
}

function normalizeHotkeySpec(spec) {
  const hotkey = spec ?? {};
  const key = String(hotkey.key ?? DEFAULT_SETTINGS.hotkey.key).toUpperCase();

  if (!HOTKEY_KEYS.includes(key)) {
    throw new Error("Hotkey must use a letter A-Z or digit 0-9.");
  }

  const modifiers = hotkey.modifiers ?? {};

  if (!hasHotkeyModifier(modifiers)) {
    throw new Error("Hotkey must include at least one modifier key.");
  }

  return {
    key,
    modifiers: {
      control: Boolean(modifiers.control),
      alt: Boolean(modifiers.alt),
      shift: Boolean(modifiers.shift),
      super: Boolean(modifiers.super),
    },
  };
}

function getEnabledHotkeyModifiers(spec) {
  const { modifiers } = normalizeHotkeySpec(spec);

  return Object.entries(modifiers)
    .filter(([, enabled]) => enabled)
    .map(([modifier]) => modifier);
}

function mergeSettings(baseSettings, nextValues = {}) {
  return {
    barcodeValue: typeof nextValues.barcodeValue === "string"
      ? nextValues.barcodeValue
      : baseSettings.barcodeValue,
    delayMs: nextValues.delayMs === undefined
      ? baseSettings.delayMs
      : clampDelay(nextValues.delayMs),
    sendEnter: nextValues.sendEnter === undefined
      ? baseSettings.sendEnter
      : Boolean(nextValues.sendEnter),
    hotkey: nextValues.hotkey === undefined
      ? normalizeHotkeySpec(baseSettings.hotkey)
      : normalizeHotkeySpec(nextValues.hotkey),
  };
}

function createAcceleratorFromSpec(spec) {
  const hotkey = normalizeHotkeySpec(spec);
  const parts = [];

  if (hotkey.modifiers.control) {
    parts.push("Control");
  }
  if (hotkey.modifiers.alt) {
    parts.push("Alt");
  }
  if (hotkey.modifiers.shift) {
    parts.push("Shift");
  }
  if (hotkey.modifiers.super) {
    parts.push(process.platform === "darwin" ? "Command" : "Super");
  }

  parts.push(hotkey.key);
  return parts.join("+");
}

function formatHotkeyLabel(spec, platform = process.platform) {
  const hotkey = normalizeHotkeySpec(spec);
  const parts = [];

  if (hotkey.modifiers.control) {
    parts.push(platform === "darwin" ? "Control" : "Ctrl");
  }
  if (hotkey.modifiers.alt) {
    parts.push(platform === "darwin" ? "Option" : "Alt");
  }
  if (hotkey.modifiers.shift) {
    parts.push("Shift");
  }
  if (hotkey.modifiers.super) {
    parts.push(platform === "darwin" ? "Command" : "Win");
  }

  parts.push(hotkey.key);
  return parts.join(" + ");
}

module.exports = {
  DEFAULT_SETTINGS,
  HOTKEY_KEYS,
  clampDelay,
  createAcceleratorFromSpec,
  formatHotkeyLabel,
  getEnabledHotkeyModifiers,
  hasHotkeyModifier,
  mergeSettings,
  normalizeBarcodeValue,
  normalizeHotkeySpec,
};
