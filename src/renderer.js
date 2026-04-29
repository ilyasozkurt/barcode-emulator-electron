import { createApp } from "vue";
import PrimeVue from "primevue/config";
import { definePreset } from "@primeuix/themes";
import Aura from "@primeuix/themes/aura";
import App from "./App.vue";
import "primeicons/primeicons.css";
import "./styles.css";

const AppThemePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: "{sky.50}",
      100: "{sky.100}",
      200: "{sky.200}",
      300: "{sky.300}",
      400: "{sky.400}",
      500: "{sky.500}",
      600: "{sky.600}",
      700: "{sky.700}",
      800: "{sky.800}",
      900: "{sky.900}",
      950: "{sky.950}",
    },
  },
});

createApp(App)
  .use(PrimeVue, {
    theme: {
      preset: AppThemePreset,
      options: {
        darkModeSelector: "none",
      },
    },
  })
  .mount("#app");
