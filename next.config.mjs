/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep undici (Next's fetch implementation) external so Webpack/SWC does
    // not try to parse its private field syntax.
    serverComponentsExternalPackages: ["undici"]
  }
};

export default nextConfig;
