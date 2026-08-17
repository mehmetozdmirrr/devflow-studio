function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, content: string, mediaType: string): void {
  downloadBlob(filename, new Blob([content], { type: mediaType }));
}

export { downloadBlob };
