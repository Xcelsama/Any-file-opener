/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // Static export can't use the default Next.js image loader (which needs a
  // running server to resize images on the fly). This app doesn't use
  // next/image, but this is set defensively in case that changes later.
  images: { unoptimized: true },
};

export default nextConfig;
