import { defineConfig, type Plugin } from 'vitest/config';
import preact from '@preact/preset-vite';

// Streng Content-Security-Policy: siden må kun hente filer fra sig selv og
// må ikke sende data nogen steder hen (connect-src 'self').
// 'wasm-unsafe-eval' er nødvendig for tekstgenkendelsen (WebAssembly).
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Sættes kun i det byggede site. Udviklingsserveren bruger inline-scripts
// til genindlæsning, som CSP'en (med vilje) ville blokere.
function csp(): Plugin {
  return {
    name: 'pladsrokaden-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
    },
  };
}

// base: './' gør bygget flytbart, så det kan ligge på GitHub Pages
// eller på skolens egen server uden ændringer.
export default defineConfig({
  base: './',
  plugins: [preact(), csp()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
