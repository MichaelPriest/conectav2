import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Native TensorFlow bindings and OCR runtime must remain Node externals.
  serverExternalPackages: ['@tensorflow/tfjs-node', '@vladmandic/human', 'tesseract.js'],
  // Vercel must trace the Node worker and every runtime-loaded Tesseract dependency.
  // The worker uses dynamic/relative requires which are not all inferred by tracing.
  outputFileTracingIncludes: {
    '/api/moderation/review': ['./node_modules/ffmpeg-static/ffmpeg'],
    '/api/identity/free-document/verify': [
      './public/vendor/human-models/**/*',
      './node_modules/tesseract.js/**/*',
      './node_modules/tesseract.js-core/**/*',
      './node_modules/bmp-js/**/*',
      './node_modules/idb-keyval/**/*',
      './node_modules/is-url/**/*',
      './node_modules/node-fetch/**/*',
      './node_modules/regenerator-runtime/**/*',
      './node_modules/wasm-feature-detect/**/*',
      './node_modules/zlibjs/**/*',
      './node_modules/whatwg-url/**/*',
      './node_modules/tr46/**/*',
      './node_modules/webidl-conversions/**/*',
    ],
  },
};

export default nextConfig;
