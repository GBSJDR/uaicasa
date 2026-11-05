import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UaiCasa — São João del-Rei',
    short_name: 'UaiCasa',
    description: 'Temporada e festas com piscina em São João del-Rei/MG',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf6ef',
    theme_color: '#2f5d50',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
