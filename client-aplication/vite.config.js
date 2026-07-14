import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'rewrite-dt-routes',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && (req.url.startsWith('/dt/') || req.url.includes('/dt/'))) {
            req.url = '/index.html';
          }
          next();
        });
      }
    }
  ],
})
