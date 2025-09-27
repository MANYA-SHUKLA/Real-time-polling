import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    // Allow dynamic API origin via env (supports deploying backend separately on Render).
    // Provide NEXT_PUBLIC_API_URL like https://your-backend.onrender.com
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
}

export default nextConfig