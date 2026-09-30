/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Next's default Server Action body limit (1MB) is well under
    // MAX_IMAGE_UPLOAD_BYTES (8MB, see lib/admin/property-image-upload.ts)
    // — uploadPropertyImage() is invoked directly as a function from
    // components/admin/PropertyImageUpload.tsx, not via <form action>, but
    // both go through the same Server Actions transport, so this limit
    // applies either way. Raised just enough to comfortably fit one 8MB
    // file plus multipart/serialization overhead.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

module.exports = nextConfig;
