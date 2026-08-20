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
            class="inline-flex cursor-pointer h-7 min-w-7 items-center justify-center rounded-full border border-slate-300 px-2 text-[0.78rem] font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!bridgeAvailable || !controlsEnabled || hotkeySaveBusy"
            @click="toggleHotkeyRecording"
          >
            <span v-if="hotkeyRecording">Cancel</span>
            <i v-else class="pi pi-pencil" aria-hidden="true" />
          </button>
        </div>
      </div>

      <section aria-label="Barcode reader emulator controls" class="relative">
        <Textarea
          id="barcodeValue"
          v-model="barcodeValue"
          :rows="10"
          placeholder="Type a barcode value..."
          :disabled="!controlsEnabled"
          class="min-h-[240px] w-full rounded-[1.9rem] border border-[#d6d6d6] bg-white px-4 py-5 text-[0.95rem] shadow-none"
          @update:modelValue="onBarcodeInput"
        />
      </section>

      <section class="flex items-center justify-between gap-3">
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

        <button
          id="speedButton"
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.76rem] font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!bridgeAvailable || !controlsEnabled || hotkeyRecording"
          @click="openSpeedDrawer"
        >
          <i class="pi pi-pencil text-[0.72rem]" aria-hidden="true" />
          <span>Speed</span>
          <span>{{ delayMs }} ms</span>
        </button>
      </section>

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

    <Drawer
      v-model:visible="hotkeyRecording"
      position="bottom"
      class="!h-auto !max-h-[50vh] rounded-t-[24px]"
      pt:header:class="!px-5 !py-4"
      aria-live="polite"
    >
      <template #header>
        <div class="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span class="relative flex h-3 w-3">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span class="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <span>Recording shortcut</span>
        </div>
      </template>

      <section class="grid gap-1 pb-2">
        <p class="m-0 text-[0.82rem] text-slate-500">{{ hotkeyRecordingMessage }}</p>
      </section>
    </Drawer>

    <Drawer
      v-model:visible="speedDrawerVisible"
      position="bottom"
      header="Speed"
      class="!h-auto !max-h-[50vh] rounded-t-[24px]"
      pt:header:class="!px-5 !py-4"
      pt:title:class="!text-base !font-semibold"
    >
      <section class="grid gap-4 pb-2">
        <div class="flex items-center justify-between gap-3 text-[0.92rem] text-slate-700">
          <span>Barcode emulating speed</span>
          <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[0.78rem] font-medium text-slate-700">
            {{ describeDelay(delayMs) }}
          </span>
        </div>
        <div class="grid gap-2">
          <input
            id="speedInput"
            :value="delayMs"
            type="range"
            min="10"
            max="100"
            step="5"
            class="h-2 w-full cursor-pointer accent-slate-900"
            :disabled="!bridgeAvailable || !controlsEnabled || hotkeyRecording"
            @input="handleDelayInput(Number($event.target.value))"
          />
          <div class="flex justify-between text-[0.75rem] text-slate-500">
            <span>Fast</span>
            <span>Slow</span>
          </div>
        </div>
      </section>
    </Drawer>
  </main>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Button from "primevue/button";
import Drawer from "primevue/drawer";
import Textarea from "primevue/textarea";

const api = window.barcodeEmulator;

const MODIFIER_ONLY_KEYS = new Set(["Alt", "AltGraph", "Control", "Meta", "Shift"]);

const bridgeAvailable = Boolean(
  api
    && typeof api.getSettings === "function"
    && typeof api.updateSettings === "function"
    && typeof api.setHotkey === "function"
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
const sendBusy = ref(false);
const hotkeyRecording = ref(false);
const hotkeySaveBusy = ref(false);
const hotkeyRecordingMessage = ref("Press the new shortcut now. Use at least one modifier and one letter or number. Press Esc to cancel.");
const pageRoot = ref(null);
const speedDrawerVisible = ref(false);

let valueSaveTimer = null;
let delaySaveTimer = null;
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

function describeDelay(value) {
  const roundedValue = Number(value);

  if (roundedValue <= 25) {
    return `Fast (${roundedValue} ms)`;
  }

  if (roundedValue <= 60) {
    return `Normal (${roundedValue} ms)`;
  }

  return `Slow (${roundedValue} ms)`;
}

function onBarcodeInput(value) {
  if (!bridgeAvailable) {
    return;
  }

  barcodeValue.value = value;
  api.syncBarcodeValue(value);
  queueBarcodeValueSave(value);
}

function queueDelaySave(value) {
  clearTimeout(delaySaveTimer);
  delaySaveTimer = setTimeout(async () => {
    try {
      await persistSettings({ delayMs: value });
    } catch (error) {
      setStatus(error.message, "error");
    }
  }, 150);
}

function handleDelayInput(value) {
  if (!bridgeAvailable) {
    return;
  }

  delayMs.value = value;

  if (currentSettings.value && value === currentSettings.value.delayMs) {
    clearTimeout(delaySaveTimer);
    return;
  }

  queueDelaySave(value);
}

function openSpeedDrawer() {
  speedDrawerVisible.value = true;
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

  const contentElement = pageElement.firstElementChild ?? pageElement;
  const measuredHeight = Math.max(
    contentElement.scrollHeight,
    Math.ceil(contentElement.getBoundingClientRect().height),
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
  clearTimeout(delaySaveTimer);
  window.removeEventListener("keydown", handleHotkeyRecordingKeydown, true);
  if (resizeFrame !== null) {
    cancelAnimationFrame(resizeFrame);
  }
});

watch(
  [barcodeValue, hotkeyLabel, delayMs, sendEnter, hotkeyRecording, hotkeyRecordingMessage],
  async () => {
    await nextTick();
    scheduleContentHeightReport();
  },
);
</script>
