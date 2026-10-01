import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // .json is served with a correct content type by default; .webmanifest often is not.
      manifestFilename: 'manifest.json',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Fuel & Burn',
        short_name: 'Fuel & Burn',
        description: 'Track what you eat against what you burn, averaged over time.',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#E9ECEF',
        background_color: '#E9ECEF',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
})
