/** Distinct file extensions from paths (e.g. `.ts`, `.md`), max `cap` items. */
export function uniqueFileExtensions(files: string[], cap = 5): string[] {
  const seen = new Set<string>();
  for (const f of files) {
    const base = f.split("/").pop() ?? f;
    const dot = base.lastIndexOf(".");
    if (dot <= 0 || dot >= base.length - 1) continue;
    const ext = base.slice(dot).toLowerCase();
    if (ext.length > 1 && ext.length <= 8) seen.add(ext);
  }
  return [...seen].sort((a, b) => a.localeCompare(b)).slice(0, cap);
}
