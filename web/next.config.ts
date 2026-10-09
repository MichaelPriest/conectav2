import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the open-source frame extractor available in traced Node.js functions.
  // FFmpeg runs as a separate process; it never uploads frames to an AI API.
  outputFileTracingIncludes: {
    '/api/moderation/review': ['./node_modules/ffmpeg-static/ffmpeg'],
  },
};

export default nextConfig;
