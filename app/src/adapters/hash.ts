async function digestHex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Shared SHA-256 (Web Crypto) helper: storage adapters use it for envelope checksums, the recommendation application layer uses it for `inputFingerprint` (kept out of the pure `domain/` layer per ARCHITECTURE.md's "domain never imports browser globals" rule). */
export async function sha256Hex(payload: unknown): Promise<string> {
  return digestHex(new TextEncoder().encode(JSON.stringify(payload)));
}

/** SHA-256 over the exact UTF-8 bytes of `text`, with no JSON-string escaping — used for `GeneratedFile.contentHash` per PACKAGE_GENERATOR.md ("File hash: SHA-256 over exact UTF-8 bytes"). */
export async function sha256HexOfText(text: string): Promise<string> {
  return digestHex(new TextEncoder().encode(text));
}
