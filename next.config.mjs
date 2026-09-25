/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  async headers() {
    return [
      {
        // Stale-while-revalidate: feed + article payloads are edge-cacheable without
        // putting DB latency in the critical rendering path (spec §9.2).
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 's-maxage=600, stale-while-revalidate=86400' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/art/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
