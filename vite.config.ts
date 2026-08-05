import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { buildContentSecurityPolicy, connectSourcesFromEnv } from './src/lib/csp.ts';

/**
 * Injects the Content Security Policy into the built `index.html` — and only
 * the built one. Pages cannot set response headers, so a meta tag is the only
 * delivery available; the dev server is left alone because Vite's HMR client
 * and React Refresh preamble are inline scripts that a `script-src 'self'`
 * policy would (correctly) refuse.
 */
function contentSecurityPolicy(env: Record<string, string>): Plugin {
  const policy = buildContentSecurityPolicy({
    connectSources: connectSourcesFromEnv(env),
    delivery: 'meta',
  });

  return {
    name: 'sovereign-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}

/**
 * Dependencies split from application code so a change to a module does not
 * invalidate the 300 KB of React, Dexie, and Zod beneath it (TD-16). The split
 * is by package rather than by size: React and the router move together because
 * they version together, and the store and the schema library each stand alone.
 */
function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (
    id.includes('/react/') ||
    id.includes('/react-dom/') ||
    id.includes('/react-router') ||
    id.includes('/scheduler/')
  ) {
    return 'vendor-react';
  }
  if (id.includes('/dexie')) return 'vendor-dexie';
  if (id.includes('/zod/')) return 'vendor-zod';
  return undefined;
}

// Deployed at the root of the GitHub Pages user site (wealthisfromwithin.github.io),
// so absolute asset URLs are required for deep links such as /integrations to resolve.
export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy(loadEnv(mode, process.cwd(), 'VITE_'))],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    // Production ships no source maps (M3, partial). The source is public on GitHub,
    // so maps add no debugging value the repository does not already provide.
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
}));
