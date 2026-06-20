import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Skin Tracker',
    short_name: 'Skin Tracker',
    description: 'Track your skin health journey',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F2F2F7',
    theme_color: '#16181A',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
