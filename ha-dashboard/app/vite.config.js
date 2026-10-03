import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Relative base so the app works behind HA ingress at any path.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  build: { target: 'es2022', cssCodeSplit: false },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8099', ws: true },
      '/ha': 'http://localhost:8099',
    },
  },
});
