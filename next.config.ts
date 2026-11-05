import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // o repositório-pai também tem um package-lock; fixa a raiz neste app
  turbopack: { root: path.resolve(__dirname) },
  images: { formats: ['image/avif', 'image/webp'] },
};

export default nextConfig;
