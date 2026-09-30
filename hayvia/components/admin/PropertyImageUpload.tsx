"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { uploadPropertyImage } from "@/app/admin/(dashboard)/properties/actions";

// Client-side guard against an accidental huge multi-select — the real
// per-file type/size validation happens server-side in uploadPropertyImage()
// (see lib/admin/property-image-upload.ts), which never trusts anything
// this component sends.
const MAX_FILES_PER_BATCH = 20;

interface PendingUpload {
  id: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  error?: string;
}

/**
 * "+ Upload Images" control for the property edit page's Images card.
 * Deliberately does NOT render its own copy of the image list — that stays
 * exactly as it was, server-rendered in [id]/page.tsx from the property's
 * real property_images rows. This component only shows its own local,
 * ephemeral upload-in-progress thumbnails (instant client-side previews via
 * URL.createObjectURL, before any network round trip) and calls
 * router.refresh() after each successful upload so the real server-rendered
 * list picks up the new row — the standard Next.js App Router pattern for
 * "server action invoked from a client component, then re-fetch server
 * data." Uploads run sequentially, one file at a time, both so
 * sort_order/is_cover (first-image-becomes-cover) stay race-free and so
 * progress can be shown per file.
 */
export default function PropertyImageUpload({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<PendingUpload[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadAll = useCallback(
    async (files: File[]) => {
      const batch: PendingUpload[] = files.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
      }));
      setItems((current) => [...current, ...batch]);
      setIsUploading(true);

      for (const item of batch) {
        const formData = new FormData();
        formData.set("file", item.file);

        let result: Awaited<ReturnType<typeof uploadPropertyImage>>;
        try {
          result = await uploadPropertyImage(propertyId, formData);
        } catch {
          result = { success: false, error: "Upload failed unexpectedly." };
        }

        setItems((current) =>
          current.map((i) =>
            i.id === item.id
              ? result.success
                ? { ...i, status: "done" as const }
                : { ...i, status: "error" as const, error: result.error || "Upload failed." }
              : i
          )
        );

        if (result.success) {
          router.refresh();
        }
      }

      setIsUploading(false);
    },
    [propertyId, router]
  );

  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      const files = Array.from(incoming).slice(0, MAX_FILES_PER_BATCH);
      if (files.length > 0) void uploadAll(files);
    },
    [uploadAll]
  );

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  return (
    <div className="mb-3">
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
          dragActive ? "border-moss-500 bg-moss-50" : "border-line-soft hover:border-moss-400"
        }`}
      >
        <ImagePlus className="mx-auto text-ink-faint" size={18} aria-hidden />
        <p className="mt-1 text-xs text-ink-soft">
          Drag images here, or <span className="font-medium text-moss-700">click to choose files</span>
        </p>
        <p className="mt-0.5 text-[11px] text-ink-faint">JPEG, PNG or WebP — max 8MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs text-ink-soft">
            {isUploading && <Loader2 className="animate-spin" size={12} />}
            {isUploading
              ? `Uploading ${doneCount + errorCount + 1} of ${items.length}...`
              : `Uploaded ${doneCount} of ${items.length}${errorCount > 0 ? ` — ${errorCount} failed` : ""}.`}
          </p>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative aspect-square overflow-hidden rounded border border-line-soft"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                {item.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
                    <Loader2 className="animate-spin text-white" size={16} />
                  </div>
                )}
                {item.status === "error" && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-red-500/70 p-1 text-center text-[10px] font-medium text-white"
                    title={item.error}
                  >
                    Failed
                  </div>
                )}
              </div>
            ))}
          </div>
          {errorCount > 0 && (
            <ul className="space-y-0.5 text-xs text-red-600">
              {items
                .filter((i) => i.status === "error")
                .map((i) => (
                  <li key={i.id}>
                    {i.file.name}: {i.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
