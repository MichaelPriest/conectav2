import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Native TensorFlow bindings and OCR runtime must remain Node externals.
  serverExternalPackages: ['@tensorflow/tfjs-node', '@vladmandic/human', 'tesseract.js'],
  // Keep runtime assets that are resolved dynamically by native/server packages.
  // Tesseract's Node worker loads its parent worker module at runtime; without
  // tracing the complete package, Vercel can ship node/index.js but omit "..".
  outputFileTracingIncludes: {
    '/api/moderation/review': ['./node_modules/ffmpeg-static/ffmpeg'],
    '/api/identity/free-document/verify': [
      './public/vendor/human-models/**/*',
      './node_modules/tesseract.js/**/*',
      './node_modules/tesseract.js-core/**/*',
    ],
  },
};

export default nextConfig;
