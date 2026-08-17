/** Lazy-loaded so `fflate` never enters the initial bundle — only imported when the user clicks "Download ZIP". */
export async function buildZipBlob(files: Array<{ path: string; content: string }>): Promise<Blob> {
  const { zipSync, strToU8 } = await import("fflate");
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    entries[file.path] = strToU8(file.content);
  }
  const zipped = zipSync(entries, { level: 6 });
  return new Blob([zipped], { type: "application/zip" });
}
