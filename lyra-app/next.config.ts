import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
};

// In local development, Node.js may fail to verify TLS certificates for
// some external APIs if the machine uses a corporate proxy or custom CA.
// This is a dev-only safety valve. Never set this in production.
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export default nextConfig;
