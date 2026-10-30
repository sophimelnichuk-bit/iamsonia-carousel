import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base './' — сайт працює з будь-якої адреси GitHub Pages (https://<user>.github.io/<repo>/)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
