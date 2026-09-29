import type { NextConfig } from "next";

/**
 * Projektwurzel explizit festlegen. Liegen weitere Lockfiles in übergeordneten
 * Ordnern (z. B. ~/package-lock.json), würde Next.js sonst einen falschen
 * Workspace-Root annehmen.
 */
const projectRoot = process.cwd();

/**
 * Einbettung in fremde Seiten (Clickjacking-Schutz).
 * Die Vorschau dieser Entwicklungsumgebung zeigt die App in einem iFrame,
 * daher standardmäßig offen. In Produktion setzen: CSP_FRAME_ANCESTORS="'none'"
 */
const frameAncestors = process.env.CSP_FRAME_ANCESTORS;

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js benötigt Inline-Skripte für die Hydrierung; keine externen Quellen erlaubt
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Daten dürfen die App nirgendwohin verlassen außer zum eigenen Server
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(frameAncestors ? [`frame-ancestors ${frameAncestors}`] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  ...(frameAncestors === "'none'" ? [{ key: "X-Frame-Options", value: "DENY" }] : []),
];

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  serverExternalPackages: ["libsql", "@libsql/client"],
  outputFileTracingRoot: projectRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
