const EDITOR_ORIGINS = new Set(["https://lovable.dev", "https://www.lovable.dev"]);

/** Only the current app or the explicitly trusted editor may drive previews. */
export function isTrustedPreviewMessageOrigin(origin: string, appOrigin: string): boolean {
  if (origin === "null" || origin.length === 0) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin) return false;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return origin === appOrigin || EDITOR_ORIGINS.has(origin);
  } catch {
    return false;
  }
}