import { defineConfig } from 'vite';

// Vite configuration to ensure .usdz files are treated as static assets
// and to add permissive CORS headers during local development so that
// Quick Look / WebXR viewers can fetch the models without browser blocks.
export default defineConfig({
  assetsInclude: ['**/*.usdz'],
  server: {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
}); 