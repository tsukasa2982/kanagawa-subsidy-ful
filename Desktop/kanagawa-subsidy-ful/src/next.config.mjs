/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // This is required for Genkit's Firebase plugin to work correctly in Next.js.
    // It ensures that certain server-side modules are bundled properly.
    experimental: {
      serverComponentsExternalPackages: ["@firebase/app-compat"],
    },
  };
  
  export default nextConfig;