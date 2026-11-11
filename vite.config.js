import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function mangaDexCoverProxy() {
  return {
    name: 'mangadex-cover-server-proxy',
    configureServer(server) {
      server.middlewares.use('/api-mangadex-covers', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        const requestUrl = new URL(req.url || '/', 'https://uploads.mangadex.org');
        if (!/^\/covers\/[0-9a-f-]+\/[^/]+$/i.test(requestUrl.pathname)) {
          res.statusCode = 400;
          res.end('Invalid cover path');
          return;
        }

        try {
          // Use the Node fetch pattern from the working Netlify function; do not forward browser headers.
          const upstream = await fetch(requestUrl);
          const body = Buffer.from(await upstream.arrayBuffer());
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
          res.setHeader('Cache-Control', upstream.ok ? 'public, max-age=86400' : 'no-store');
          res.end(body);
        } catch (error) {
          console.error('[MangaShelf:cover-proxy] MangaDex request failed', error);
          res.statusCode = 502;
          res.end('Cover proxy request failed');
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), mangaDexCoverProxy()],
  server: {
    proxy: {
      '/api-jikan': {
        target: 'https://api.jikan.moe/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-jikan/, '')
      },
      '/api-mangadex/': {
        target: 'https://api.mangadex.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-mangadex/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('User-Agent', 'MangaShelfApp/1.0');
          });
        }
      },
      '/api-anilist': {
        target: 'https://graphql.anilist.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-anilist/, '')
      }
    }
  }
})
