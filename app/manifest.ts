import type { MetadataRoute } from 'next';

/** Lets people install Doreham to their home screen (needed for notifications on iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Doreham 도레함',
    short_name: 'Doreham',
    description: 'Small adventures, real friends. 작은 모험, 진짜 친구.',
    start_url: '/matches',
    scope: '/',
    display: 'standalone',
    background_color: '#F5F2EB',
    theme_color: '#F5F2EB',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
