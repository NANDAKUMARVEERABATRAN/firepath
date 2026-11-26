import { NextResponse } from "next/server";

/**
 * Digital Asset Links, served at /.well-known/assetlinks.json (see the rewrite in next.config.mjs).
 * Proves to Android that the FIREpath Play app and this website belong together, so the app opens
 * full-screen without a browser address bar.
 *
 * Set in the hosting environment:
 *   ANDROID_PACKAGE_NAME          e.g. app.firepath.twa
 *   ANDROID_SHA256_FINGERPRINTS   comma-separated SHA-256 signing-key fingerprints, from
 *                                 Play Console → Setup → App signing (add the upload key too while testing)
 */
export const dynamic = "force-dynamic"; // read env at request time, so a redeploy isn't needed after setting it

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map(value => value.trim().toUpperCase())
    .filter(value => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));

  const body = packageName && fingerprints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints } }]
    : [];

  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
