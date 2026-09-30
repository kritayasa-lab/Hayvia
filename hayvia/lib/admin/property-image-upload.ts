// -----------------------------------------------------------------------------
// Property image upload — validation + storage path helpers
// -----------------------------------------------------------------------------
// Pure, no "server-only"/Next.js dependency, so it's directly unit-testable
// (see uploadPropertyImage() in ../../app/admin/(dashboard)/properties/
// actions.ts, the only caller). Deliberately does nothing beyond
// validating and naming a file — no resizing, no compression, no format
// conversion: the uploaded original bytes are stored exactly as received.
// -----------------------------------------------------------------------------

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Sniffs the real file type from its magic bytes rather than trusting the
 * browser-supplied `file.type` or the filename's extension (both are
 * client-controlled and easy to get wrong or spoof). Returns one of the
 * three allowed MIME types, or null if the bytes don't match any of them
 * — including when the buffer is too short to contain a valid signature.
 */
export function sniffImageMimeType(buffer: Uint8Array): AllowedImageMimeType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 && // "RIFF"
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50 // "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const EXTENSION_FOR_MIME: Record<AllowedImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Builds the storage object key for an uploaded file:
 * {propertyId}/{uuid}-{sanitized original filename or a generated one}.
 * The uuid alone already guarantees uniqueness — the original filename is
 * kept (sanitized) only for admins skimming the bucket in the Supabase
 * dashboard, never as the identifier itself, so two uploads named
 * "photo.jpg" can never collide or overwrite one another.
 */
export function buildStorageObjectKey(
  propertyId: string,
  originalFilename: string,
  mimeType: AllowedImageMimeType,
  uuid: string
): string {
  const base = originalFilename.replace(/\.[^./\\]+$/, "");
  const sanitizedBase =
    base
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "image";
  return `${propertyId}/${uuid}-${sanitizedBase}.${EXTENSION_FOR_MIME[mimeType]}`;
}

export interface ImageUploadValidationError {
  ok: false;
  error: string;
}

export interface ImageUploadValidationSuccess {
  ok: true;
  mimeType: AllowedImageMimeType;
}

/**
 * Full server-side validation for one uploaded file: size, then real
 * content-sniffed type (never just the extension or the client-supplied
 * file.type). Returns a clear, specific error message naming the file on
 * any rejection — callers must surface this, never silently drop the file.
 */
export function validateImageUpload(
  filename: string,
  sizeBytes: number,
  buffer: Uint8Array
): ImageUploadValidationError | ImageUploadValidationSuccess {
  if (sizeBytes === 0) {
    return { ok: false, error: `"${filename}" is empty.` };
  }
  if (sizeBytes > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `"${filename}" is too large (max ${MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)}MB).`,
    };
  }
  const mimeType = sniffImageMimeType(buffer);
  if (!mimeType) {
    return {
      ok: false,
      error: `"${filename}" isn't a supported image file (only JPEG, PNG, or WebP are allowed).`,
    };
  }
  return { ok: true, mimeType };
}
