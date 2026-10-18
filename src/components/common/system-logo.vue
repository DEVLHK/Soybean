<script setup lang="ts">
import { useThemeStore } from '@/store/modules/theme';
import logoHsg from '@/assets/imgs/logo-hsg.svg';

defineOptions({
  name: 'SystemLogo'
});

const themeStore = useThemeStore();
</script>

<template>
  <div class="app-logo" :class="{ 'app-logo--light': !themeStore.darkMode }">
    <img class="h-full w-full object-contain" :src="logoHsg" alt="logo" />
  </div>
</template>

<style scoped>
.app-logo {
  --logo-color-300: rgb(var(--primary-300-color));
  --logo-color-400: rgb(var(--primary-400-color));
  --logo-color-500: rgb(var(--primary-500-color));
  --logo-color-600: rgb(var(--primary-600-color));
  --logo-color-700: rgb(var(--primary-700-color));
}

/* light theme: the white highlight of the icon is invisible on white background, add shadow */
.app-logo--light img {
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.28));
}
</style>
