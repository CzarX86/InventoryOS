/**
 * Formats the NEXT_PUBLIC_APP_VERSION build string (`<version>+<sha>`)
 * into a short human label such as `v0.1.0 (460e138)`.
 * Builds without a version (local dev) are labeled `dev`.
 */
export function formatAppVersion(rawVersion: string | undefined | null): string {
  if (!rawVersion) return "dev";
  const separatorIndex = rawVersion.indexOf("+");
  if (separatorIndex === -1) return `v${rawVersion}`;
  const version = rawVersion.slice(0, separatorIndex);
  const shortSha = rawVersion.slice(separatorIndex + 1, separatorIndex + 8);
  return `v${version} (${shortSha})`;
}
