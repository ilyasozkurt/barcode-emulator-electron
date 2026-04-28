<template>
  <section class="border border-[#d9d9d9] bg-white px-3 py-3">
    <div class="mb-3">
      <h1 class="m-0 text-[1.15rem] font-bold text-slate-800">Settings</h1>
      <p class="mt-1 text-sm text-slate-500">Manage hotkey and typing behavior in a separate native window.</p>
    </div>

    <section class="grid gap-3">
      <div class="grid gap-2.5 rounded-[10px] border border-slate-200 bg-white p-3">
        <div>
          <p class="m-0 text-[0.92rem] font-bold text-slate-900">Global hotkey</p>
          <p class="mt-1 text-[0.82rem] text-slate-500">Pick at least one modifier and one letter or digit.</p>
        </div>

        <p
          id="dialogCurrentHotkey"
          class="m-0 rounded-[10px] border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-900"
        >
          {{ currentHotkeyText }}
        </p>

        <div class="grid grid-cols-2 gap-x-3 gap-y-2 max-[340px]:grid-cols-1">
          <label class="flex min-h-5 cursor-pointer items-center gap-2 text-[0.88rem] text-slate-900">
            <input v-model="localDraftHotkey.modifiers.control" type="checkbox" class="h-4 w-4 accent-slate-900" />
            <span>Ctrl / Control</span>
          </label>
          <label class="flex min-h-5 cursor-pointer items-center gap-2 text-[0.88rem] text-slate-900">
            <input v-model="localDraftHotkey.modifiers.alt" type="checkbox" class="h-4 w-4 accent-slate-900" />
            <span>Alt / Option</span>
          </label>
          <label class="flex min-h-5 cursor-pointer items-center gap-2 text-[0.88rem] text-slate-900">
            <input v-model="localDraftHotkey.modifiers.shift" type="checkbox" class="h-4 w-4 accent-slate-900" />
            <span>Shift</span>
          </label>
          <label class="flex min-h-5 cursor-pointer items-center gap-2 text-[0.88rem] text-slate-900">
            <input v-model="localDraftHotkey.modifiers.super" type="checkbox" class="h-4 w-4 accent-slate-900" />
            <span>Win / Command</span>
          </label>
        </div>

        <label class="grid gap-1.5">
          <span class="text-[0.82rem] text-slate-500">Main key</span>
          <select
            v-model="localDraftHotkey.key"
            class="w-full rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-[0.9rem] text-slate-900 outline-none focus:border-slate-400"
          >
            <option v-for="key in hotkeyKeys" :key="key" :value="key">
              {{ key }}
            </option>
          </select>
        </label>

        <div class="flex items-center justify-between gap-2">
          <span class="text-[0.82rem] text-slate-500">Preview</span>
          <span
            id="dialogPreview"
            class="rounded-full bg-slate-900 px-2.5 py-1 text-[0.78rem] font-semibold text-white"
          >
            {{ draftHotkeyLabel }}
          </span>
        </div>

        <div class="flex justify-end">
          <button
            id="saveHotkeyButton"
            type="button"
            class="inline-flex cursor-pointer items-center rounded-[10px] bg-slate-900 px-3 py-2 text-[0.88rem] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            :disabled="!bridgeAvailable"
            @click="$emit('save-hotkey')"
          >
            Save hotkey
          </button>
        </div>
      </div>

      <div class="rounded-[10px] border border-slate-200 bg-white p-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="m-0 text-[0.92rem] font-bold text-slate-900">Input key delay</p>
            <p class="mt-1 text-[0.82rem] text-slate-500">Fine-tune how fast each character is typed.</p>
          </div>
          <span
            id="delayValue"
            class="rounded-full bg-slate-900 px-2.5 py-1 text-[0.78rem] font-semibold text-white"
          >
            {{ delayMs }} ms
          </span>
        </div>
        <input
          id="delayInput"
          :value="delayMs"
          type="range"
          class="mt-3 block w-full accent-slate-900"
          min="10"
          max="100"
          step="1"
          :disabled="!bridgeAvailable"
          @input="$emit('update:delay-ms', Number($event.target.value))"
          @change="$emit('delay-change')"
        />
      </div>

      <div class="grid gap-3 rounded-[10px] border border-slate-200 bg-white p-3">
        <div>
          <p class="m-0 text-[0.92rem] font-bold text-slate-900">Send ENTER at the end</p>
          <p class="mt-1 text-[0.82rem] text-slate-500">Useful when the target app expects the barcode to submit immediately.</p>
        </div>
        <label class="flex cursor-pointer items-center gap-2 text-[0.88rem] text-slate-900">
          <input
            id="sendEnterInput"
            :checked="sendEnter"
            type="checkbox"
            class="h-4 w-4 accent-slate-900"
            :disabled="!bridgeAvailable"
            @change="$emit('update:send-enter', $event.target.checked)"
          />
          <span>Enable trailing ENTER</span>
        </label>
      </div>

      <p v-if="!bridgeAvailable" class="m-0 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 text-[0.82rem] text-amber-800">
        Electron bridge is unavailable in this window, so settings cannot be saved yet.
      </p>
    </section>
  </section>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  bridgeAvailable: { type: Boolean, required: true },
  controlsEnabled: { type: Boolean, required: true },
  currentHotkeyText: { type: String, required: true },
  delayMs: { type: Number, required: true },
  draftHotkey: { type: Object, required: true },
  draftHotkeyLabel: { type: String, required: true },
  hotkeyKeys: { type: Array, required: true },
  sendEnter: { type: Boolean, required: true },
});

const emit = defineEmits([
  "delay-change",
  "save-hotkey",
  "update:delay-ms",
  "update:draft-hotkey",
  "update:send-enter",
]);

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

const localDraftHotkey = ref(cloneHotkey(props.draftHotkey));

watch(
  () => props.draftHotkey,
  (value) => {
    localDraftHotkey.value = cloneHotkey(value);
  },
  { deep: true },
);

watch(
  localDraftHotkey,
  (value) => {
    emit("update:draft-hotkey", cloneHotkey(value));
  },
  { deep: true },
);
</script>
