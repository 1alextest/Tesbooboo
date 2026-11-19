import * as path from "path";

/**
 * A filename-derived extension that is safe to append to a storage key.
 *
 * Keys are otherwise built from UUIDs, and the extension was the one part that came from the
 * upload: `path.extname` keeps only the text after the last dot, but it is still caller-supplied
 * text going into a filesystem path (and into the S3 key). An allowlist — lowercase letters and
 * digits only, at most ten of them — means anything unusual is simply dropped from the key rather
 * than propagated. The stored display name keeps the original, so the user still sees their file
 * name.
 *
 * Returns the extension with its leading dot ("" when there is no usable one), ready to concatenate
 * after the generated name.
 */
export function storageKeyExtension(filename: string): string {
  const ext = path.extname(String(filename || "")).replace(/^\./, "").toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(ext) ? `.${ext}` : "";
}
