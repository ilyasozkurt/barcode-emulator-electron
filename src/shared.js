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

const SUFFIX_KEYS = Object.freeze(["none", "enter", "tab"]);

const HOTKEY_FUNCTION_KEYS = Object.freeze([
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
]);

const QUICK_TOGGLE_KEYS = Object.freeze([...HOTKEY_KEYS, ...HOTKEY_FUNCTION_KEYS]);

const DEFAULT_SETTINGS = Object.freeze({
  barcodeValue: "test",
  delayMs: 10,
  sendEnter: false,
  suffixKey: "enter",
  startOnBoot: false,
  notificationsEnabled: true,
  quickToggleEnabled: false,
  skippedUpdateVersion: null,
  quickToggleHotkey: {
    key: "F9",
    modifiers: {
      control: false,
      alt: false,
      shift: false,
      super: false,
    },
  },
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

function normalizeSuffixKey(suffixKey) {
  const normalized = String(suffixKey ?? DEFAULT_SETTINGS.suffixKey).toLowerCase();
  return SUFFIX_KEYS.includes(normalized) ? normalized : DEFAULT_SETTINGS.suffixKey;
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

function normalizeQuickToggleHotkeySpec(spec) {
  const hotkey = spec ?? {};
  const key = String(hotkey.key ?? DEFAULT_SETTINGS.quickToggleHotkey.key).toUpperCase();

  if (!QUICK_TOGGLE_KEYS.includes(key)) {
    throw new Error("Show/hide hotkey must use a letter A-Z, digit 0-9, or F1-F12.");
  }

  const modifiers = hotkey.modifiers ?? {};

  if (!HOTKEY_FUNCTION_KEYS.includes(key) && !hasHotkeyModifier(modifiers)) {
    throw new Error("Show/hide hotkey must include at least one modifier key.");
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
    suffixKey: nextValues.suffixKey === undefined
      ? normalizeSuffixKey(baseSettings.suffixKey)
      : normalizeSuffixKey(nextValues.suffixKey),
    startOnBoot: nextValues.startOnBoot === undefined
      ? Boolean(baseSettings.startOnBoot)
      : Boolean(nextValues.startOnBoot),
    notificationsEnabled: nextValues.notificationsEnabled === undefined
      ? (baseSettings.notificationsEnabled === undefined ? true : Boolean(baseSettings.notificationsEnabled))
      : Boolean(nextValues.notificationsEnabled),
    quickToggleEnabled: nextValues.quickToggleEnabled === undefined
      ? Boolean(baseSettings.quickToggleEnabled)
      : Boolean(nextValues.quickToggleEnabled),
    skippedUpdateVersion: nextValues.skippedUpdateVersion === undefined
      ? (baseSettings.skippedUpdateVersion ?? null)
      : (nextValues.skippedUpdateVersion === null ? null : String(nextValues.skippedUpdateVersion)),
    quickToggleHotkey: nextValues.quickToggleHotkey === undefined
      ? normalizeQuickToggleHotkeySpec(baseSettings.quickToggleHotkey)
      : normalizeQuickToggleHotkeySpec(nextValues.quickToggleHotkey),
    hotkey: nextValues.hotkey === undefined
      ? normalizeHotkeySpec(baseSettings.hotkey)
      : normalizeHotkeySpec(nextValues.hotkey),
  };
}

function createAcceleratorFromSpec(spec, normalize = normalizeHotkeySpec) {
  const hotkey = normalize(spec);
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

function formatHotkeyLabel(spec, platform = process.platform, normalize = normalizeHotkeySpec) {
  const hotkey = normalize(spec);
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
  HOTKEY_FUNCTION_KEYS,
  SUFFIX_KEYS,
  QUICK_TOGGLE_KEYS,
  clampDelay,
  createAcceleratorFromSpec,
  formatHotkeyLabel,
  getEnabledHotkeyModifiers,
  hasHotkeyModifier,
  mergeSettings,
  normalizeBarcodeValue,
  normalizeHotkeySpec,
  normalizeSuffixKey,
  normalizeQuickToggleHotkeySpec,
};
