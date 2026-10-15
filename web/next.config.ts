import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Native TensorFlow bindings and the OCR runtime must remain Node externals.
  serverExternalPackages: ['@tensorflow/tfjs-node', '@vladmandic/human', 'tesseract.js'],
  // Keep the open-source frame extractor available in traced Node.js functions.
  // FFmpeg runs as a separate process; it never uploads frames to an AI API.
  outputFileTracingIncludes: {
    '/api/moderation/review': ['./node_modules/ffmpeg-static/ffmpeg'],
    '/api/identity/free-document/verify': ['./public/vendor/human-models/**/*'],
  },
};

export default nextConfig;
