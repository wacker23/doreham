import type { NextConfig } from "next";

/**
 * Security headers for every response.
 * - Enforced: no framing (clickjacking), no MIME sniffing, a strict referrer, browser
 *   features limited to what Doreham uses (camera for QR check-in, location for check-in),
 *   HTTPS only, and a minimal CSP that can't break the pages (no <base>/<object>, no framing).
 * - CSP_REPORT_ONLY: the full content policy, reported in the browser console but not enforced
 *   yet. Once it shows no violations on the live site, it can move to the enforced header.
 */
const CSP_ENFORCED = ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'"].join('; ');

const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://t1.daumcdn.net https://ssl.daumcdn.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://*.kakaocdn.net https://*.daumcdn.net",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src https://*.daum.net https://*.kakao.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP_ENFORCED },
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // The service worker must never be cached, or phones keep an old version.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
