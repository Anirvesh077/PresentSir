import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// the API runs on :4000, proxy so the browser only ever talks to one origin
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
});
