<template>
  <main ref="pageRoot" class="bg-white">
    <section class="grid gap-3 p-4">
      <div class="mb-2 grid gap-1">
        <h1 class="m-0 text-[1.15rem] font-bold text-slate-800">Barcode reader emulator</h1>
        <div class="flex items-center gap-2">
          <span class="text-[0.95rem] font-medium text-slate-700">({{ hotkeyLabel }})</span>
          <button
            id="editHotkeyButton"
            type="button"
            class="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-300 px-2 text-[0.78rem] font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!bridgeAvailable || !controlsEnabled || hotkeySaveBusy"
            @click="toggleHotkeyRecording"
          >
            <span v-if="hotkeyRecording">Cancel</span>
            <i v-else class="pi pi-pencil" aria-hidden="true" />
          </button>
        </div>
      </div>

      <section aria-label="Barcode reader emulator controls" class="relative">
        <Button
          id="scanButton"
          icon="pi pi-search"
          severity="secondary"
          text
          rounded
          aria-label="Scan from screen"
          class="!absolute top-2.5 right-3 z-10 !h-9 !w-9"
          :loading="scanBusy"
          :disabled="!bridgeAvailable || !controlsEnabled || scanBusy || hotkeyRecording"
          @click="scanFromScreen"
        />
        <Textarea
          id="barcodeValue"
          v-model="barcodeValue"
          :rows="5"
          auto-resize
          :maxlength="128"
          placeholder="Type a barcode value..."
          :disabled="!controlsEnabled"
          class="min-h-[132px] w-full rounded-[1.9rem] border border-[#d6d6d6] bg-white px-4 py-5 pr-14 text-[0.95rem] shadow-none"
          @update:modelValue="onBarcodeInput"
        />
      </section>

      <label
        class="flex cursor-pointer items-center gap-2 text-[0.88rem] text-slate-700"
        :class="{ 'opacity-50': !bridgeAvailable || !controlsEnabled }"
      >
        <input
          id="sendEnterInput"
          :checked="sendEnter"
          type="checkbox"
          class="h-4 w-4 accent-slate-900"
          :disabled="!bridgeAvailable || !controlsEnabled"
          @change="handleSendEnterUpdate($event.target.checked)"
        />
        <span>Send ENTER at the end</span>
      </label>

      <Button
        id="sendButton"
        fluid
        size="large"
        :loading="sendBusy"
        :disabled="!bridgeAvailable || !controlsEnabled || sendBusy || hotkeyRecording"
        @click="sendBarcode"
      >
        <div class="grid gap-0">
          <div>Emulate</div>
          <div class="text-sm">({{ hotkeyLabel }})</div>
        </div>
      </Button>
    </section>

    <div
      v-if="hotkeyRecording"
      class="pointer-events-none fixed inset-0 z-30 flex items-end bg-black/15"
      aria-live="polite"
    >
      <section class="pointer-events-auto w-full rounded-t-[22px] border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
        <div class="flex items-start justify-between gap-3">
          <div class="grid gap-1">
            <p class="m-0 text-[0.96rem] font-semibold text-slate-900">Recording shortcut</p>
            <p class="m-0 text-[0.82rem] text-slate-500">{{ hotkeyRecordingMessage }}</p>
          </div>
          <button
            type="button"
            class="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-slate-300 px-3 text-[0.8rem] font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
            @click="toggleHotkeyRecording"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Button from "primevue/button";
import Textarea from "primevue/textarea";

const api = window.barcodeEmulator;

const MODIFIER_ONLY_KEYS = new Set(["Alt", "AltGraph", "Control", "Meta", "Shift"]);

const bridgeAvailable = Boolean(
  api
    && typeof api.getSettings === "function"
    && typeof api.updateSettings === "function"
    && typeof api.setHotkey === "function"
    && typeof api.scanScreenBarcode === "function"
    && typeof api.emulateBarcode === "function"
    && typeof api.reportContentHeight === "function"
    && typeof api.syncBarcodeValue === "function"
    && typeof api.onStatus === "function"
    && typeof api.normalizeBarcodeValue === "function",
);

function cloneHotkey(hotkey) {
  return {
    key: hotkey?.key ?? "A",
    modifiers: {
      control: Boolean(hotkey?.modifiers?.control),
      alt: Boolean(hotkey?.modifiers?.alt),
      shift: Boolean(hotkey?.modifiers?.shift),
      super: Boolean(hotkey?.modifiers?.super),
    },
  };
}

function hasHotkeyModifier(modifiers = {}) {
  return Boolean(modifiers.control || modifiers.alt || modifiers.shift || modifiers.super);
}

function extractRecordedHotkeyKey(event) {
  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3);
  }

  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.slice(5);
  }

  if (/^Numpad[0-9]$/.test(event.code)) {
    return event.code.slice(6);
  }

  const normalizedKey = String(event.key ?? "").toUpperCase();
  return /^[A-Z0-9]$/.test(normalizedKey) ? normalizedKey : null;
}

const controlsEnabled = ref(false);
const barcodeValue = ref("");
const hotkeyLabel = ref("Loading hotkey...");
const delayMs = ref(30);
const sendEnter = ref(false);
const statusMessage = ref("");
const statusType = ref("idle");
const draftHotkey = ref(
  cloneHotkey({
    key: "A",
    modifiers: { control: true, alt: true, shift: false, super: false },
  }),
);
const currentSettings = ref(null);
const scanBusy = ref(false);
const sendBusy = ref(false);
const hotkeyRecording = ref(false);
const hotkeySaveBusy = ref(false);
const hotkeyRecordingMessage = ref("Press the new shortcut now. Use at least one modifier and one letter or number. Press Esc to cancel.");
const pageRoot = ref(null);

let valueSaveTimer = null;
let unsubscribeStatus = null;
let resizeFrame = null;

function setStatus(message, type = "info") {
  statusMessage.value = message;
  statusType.value = type;
}

function clearStatus() {
  statusMessage.value = "";
  statusType.value = "idle";
}

function applySettingsState(settingsState) {
  currentSettings.value = settingsState.settings;
  barcodeValue.value = settingsState.settings.barcodeValue;
  hotkeyLabel.value = settingsState.hotkeyLabel;
  delayMs.value = settingsState.settings.delayMs;
  sendEnter.value = settingsState.settings.sendEnter;
  draftHotkey.value = cloneHotkey(settingsState.settings.hotkey);
  controlsEnabled.value = true;
}

async function persistSettings(partialSettings) {
  clearTimeout(valueSaveTimer);
  const settingsState = await api.updateSettings(partialSettings);
  applySettingsState(settingsState);
}

function queueBarcodeValueSave(value) {
  clearTimeout(valueSaveTimer);
  valueSaveTimer = setTimeout(async () => {
    try {
      await persistSettings({ barcodeValue: value });
    } catch (error) {
      setStatus(error.message, "error");
    }
  }, 150);
}

function onBarcodeInput(value) {
  if (!bridgeAvailable) {
    return;
  }

  barcodeValue.value = value;
  api.syncBarcodeValue(value);
  queueBarcodeValueSave(value);
}

async function scanFromScreen() {
  scanBusy.value = true;

  try {
    const scannedValue = await api.scanScreenBarcode();
    barcodeValue.value = scannedValue;
    api.syncBarcodeValue(scannedValue);
    await persistSettings({ barcodeValue: scannedValue });
    setStatus("Barcode value updated from the screen.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    scanBusy.value = false;
  }
}

async function sendBarcode() {
  sendBusy.value = true;

  try {
    await api.emulateBarcode();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    sendBusy.value = false;
  }
}

async function saveHotkey(nextHotkey = draftHotkey.value) {
  hotkeySaveBusy.value = true;

  try {
    const settingsState = await api.setHotkey(nextHotkey);
    applySettingsState(settingsState);
    setStatus(`Hotkey updated to ${settingsState.hotkeyLabel}.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    hotkeySaveBusy.value = false;
  }
}

async function onSendEnterChange() {
  if (!currentSettings.value || sendEnter.value === currentSettings.value.sendEnter) {
    return;
  }

  try {
    await persistSettings({ sendEnter: sendEnter.value });
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function handleSendEnterUpdate(value) {
  sendEnter.value = value;
  onSendEnterChange();
}

function toggleHotkeyRecording() {
  hotkeyRecording.value = !hotkeyRecording.value;
  hotkeyRecordingMessage.value = "Press the new shortcut now. Use at least one modifier and one letter or number. Press Esc to cancel.";
}

async function handleHotkeyRecordingKeydown(event) {
  if (!hotkeyRecording.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    hotkeyRecording.value = false;
    hotkeyRecordingMessage.value = "Press the new shortcut now. Use at least one modifier and one letter or number. Press Esc to cancel.";
    return;
  }

  if (event.repeat || MODIFIER_ONLY_KEYS.has(event.key)) {
    return;
  }

  const recordedKey = extractRecordedHotkeyKey(event);
  if (!recordedKey) {
    hotkeyRecordingMessage.value = "Use a letter A-Z or digit 0-9 for the main key.";
    return;
  }

  const recordedHotkey = cloneHotkey({
    key: recordedKey,
    modifiers: {
      control: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      super: event.metaKey,
    },
  });

  if (!hasHotkeyModifier(recordedHotkey.modifiers)) {
    hotkeyRecordingMessage.value = "Include at least one modifier key such as Ctrl, Alt, Shift, or Win/Command.";
    return;
  }

  draftHotkey.value = recordedHotkey;
  hotkeyRecording.value = false;
  hotkeyRecordingMessage.value = "Press the new shortcut now. Use at least one modifier and one letter or number. Press Esc to cancel.";
  await saveHotkey(recordedHotkey);
}

async function init() {
  if (!bridgeAvailable) {
    hotkeyLabel.value = "Unavailable";
    setStatus(
      "Electron bridge is unavailable. Restart the app from Electron instead of opening the HTML file directly.",
      "error",
    );
    return;
  }

  unsubscribeStatus = api.onStatus(({ message, type }) => {
    setStatus(message, type);
  });

  try {
    const settingsState = await api.getSettings();
    applySettingsState(settingsState);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function reportContentHeight() {
  if (!bridgeAvailable) {
    return;
  }

  const pageElement = pageRoot.value;
  if (!pageElement) {
    return;
  }

  const measuredHeight = Math.max(
    pageElement.scrollHeight,
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
  );

  api.reportContentHeight(measuredHeight);
}

function scheduleContentHeightReport() {
  if (resizeFrame !== null) {
    cancelAnimationFrame(resizeFrame);
  }

  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    reportContentHeight();
  });
}

onMounted(() => {
  init();
  window.addEventListener("keydown", handleHotkeyRecordingKeydown, true);
  scheduleContentHeightReport();
});

onBeforeUnmount(() => {
  unsubscribeStatus?.();
  clearTimeout(valueSaveTimer);
  window.removeEventListener("keydown", handleHotkeyRecordingKeydown, true);
  if (resizeFrame !== null) {
    cancelAnimationFrame(resizeFrame);
  }
});

watch(
  [barcodeValue, hotkeyLabel, sendEnter, hotkeyRecording, hotkeyRecordingMessage],
  async () => {
    await nextTick();
    scheduleContentHeightReport();
  },
);
</script>
