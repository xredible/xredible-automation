// Served at /.well-known/assetlinks.json (see next.config.ts). Tells Android that the Xredible app may open
// www.xredible.in full screen (Trusted Web Activity). Fingerprints: our upload/direct-download key, plus any
// in ANDROID_SHA256 (comma-separated), e.g. Google Play's app signing key from Play Console → App integrity.

const BUILT_IN = ["9C:8F:F4:2E:3D:89:4D:20:7A:15:F6:78:28:B2:81:8E:B3:66:4C:5D:B2:90:CB:BA:D5:61:AA:1C:5D:15:7E:FF"]

export const dynamic = "force-dynamic"

export function GET() {
  const extra = String(process.env.ANDROID_SHA256 || "")
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s))
  const fingerprints = [...new Set([...BUILT_IN, ...extra])]
  return Response.json(
    [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "com.xredible.app", sha256_cert_fingerprints: fingerprints } }],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  )
}
