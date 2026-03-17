import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: "/offline.html",
  },
  workboxOptions: {
    // Don't cache firebase, google auth or AI API calls
    navigateFallbackDenylist: [/^\/api\//, /firestore/, /googleapis/],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  turbopack: {},
};

export default withPWA(nextConfig);
