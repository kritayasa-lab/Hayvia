"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { ArrowRight, ImagePlus, X } from "lucide-react";
import { FieldWrapper, TextInput, TextArea } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import {
  importPropertyFromUrl,
  importPropertyFromManualContent,
} from "@/app/admin/(dashboard)/properties/import/actions";

// Mirrors MAX_SCREENSHOT_COUNT in ../import/actions.ts — the server is the
// real enforcement point (a request with more than this is rejected
// outright, never silently truncated); this is purely for immediate client
// feedback while picking files.
const MAX_SCREENSHOTS = 10;

interface ScreenshotEntry {
  file: File;
  previewUrl: string;
}

/**
 * Two-stage import UI. Stage 1 is always visible (paste a URL). If the
 * server-side fetch fails for any reason — blocked, login wall, JS-rendered
 * page, network error, or the AI step itself failing/unconfigured — the
 * action returns `fallback: true` and stage 2 appears: paste the listing
 * text directly and/or upload one or more screenshots (e.g. several
 * screenshots of the same Facebook post), or just go create the property
 * by hand. The admin is never left at a dead end.
 */
export default function ImportPropertyForm() {
  const [urlState, urlFormAction] = useFormState(importPropertyFromUrl, null);
  const [manualState, manualFormAction] = useFormState(importPropertyFromManualContent, null);
  const [typedUrl, setTypedUrl] = useState("");
  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>([]);
  const [screenshotNotice, setScreenshotNotice] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showFallback = Boolean(urlState?.fallback || manualState?.fallback);

  // Keep the real <input type="file" multiple> element's FileList in sync
  // with React state, via the standard DataTransfer trick — this is what
  // lets individual-screenshot removal work (native file inputs have no
  // API to remove a single file from their own FileList) while the form
  // still submits the correct set through the ordinary named-field path a
  // server action reads via formData.getAll("screenshots").
  const syncInputFiles = useCallback((entries: ScreenshotEntry[]) => {
    const transfer = new DataTransfer();
    entries.forEach((entry) => transfer.items.add(entry.file));
    if (fileInputRef.current) fileInputRef.current.files = transfer.files;
  }, []);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const images = Array.from(incoming).filter((file) => file.type.startsWith("image/"));
      if (images.length === 0) return;

      setScreenshots((current) => {
        const combined = [
          ...current,
          ...images.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
        ];
        if (combined.length > MAX_SCREENSHOTS) {
          setScreenshotNotice(`Only the first ${MAX_SCREENSHOTS} screenshots were kept (max ${MAX_SCREENSHOTS} per import).`);
          combined.slice(MAX_SCREENSHOTS).forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
        } else {
          setScreenshotNotice(null);
        }
        const next = combined.slice(0, MAX_SCREENSHOTS);
        syncInputFiles(next);
        return next;
      });
    },
    [syncInputFiles]
  );

  const removeScreenshot = useCallback(
    (index: number) => {
      setScreenshots((current) => {
        const removed = current[index];
        if (removed) URL.revokeObjectURL(removed.previewUrl);
        const next = current.filter((_, i) => i !== index);
        syncInputFiles(next);
        return next;
      });
      setScreenshotNotice(null);
    },
    [syncInputFiles]
  );

  // Revoke any remaining preview URLs if the admin navigates away (e.g. to
  // "Continue to manual property creation") without submitting.
  useEffect(() => {
    return () => {
      screenshots.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <form action={urlFormAction} className="space-y-4">
        <FieldWrapper
          label="Property URL"
          htmlFor="url"
          required
          hint="A public listing page — the site's own listing, a classifieds post, etc."
        >
          <TextInput
            id="url"
            name="url"
            type="url"
            required
            placeholder="https://example.com/listing/123"
            value={typedUrl}
            onChange={(e) => setTypedUrl(e.target.value)}
          />
        </FieldWrapper>
        <FormMessage state={urlState} />
        <SubmitButton pendingLabel="Fetching & extracting...">Fetch &amp; Extract</SubmitButton>
      </form>

      {showFallback && (
        <div className="space-y-4 rounded-lg border border-dashed border-line-soft bg-seashell/30 p-5">
          <div>
            <h3 className="font-display text-base text-ink">Couldn&apos;t read that source</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Some sources (Facebook and other social links especially) are login-walled or block
              automatic reading. Try one of these instead — nothing here is a dead end.
            </p>
          </div>

          <form action={manualFormAction} className="space-y-4">
            <input type="hidden" name="source_url" value={typedUrl} />
            <FieldWrapper
              label="Paste the listing text"
              htmlFor="pasted_text"
              hint="Copy the title, price, description, etc. straight from the source page or message."
            >
              <TextArea
                id="pasted_text"
                name="pasted_text"
                placeholder="Paste the listing text here..."
              />
            </FieldWrapper>

            <FieldWrapper label="Or upload screenshots" htmlFor="screenshots">
              <p className="mb-2 text-sm text-ink-soft">
                Upload screenshots of the Facebook post. You can select multiple images.
              </p>

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
                  if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
                }}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                  dragActive ? "border-moss-500 bg-moss-50" : "border-line-soft hover:border-moss-400"
                }`}
              >
                <ImagePlus className="mx-auto text-ink-faint" size={22} aria-hidden />
                <p className="mt-1.5 text-xs text-ink-soft">
                  Drag screenshots here, or <span className="font-medium text-moss-700">click to choose files</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">Up to {MAX_SCREENSHOTS} images — used only for AI extraction, never saved as property photos.</p>
                <input
                  ref={fileInputRef}
                  id="screenshots"
                  name="screenshots"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
                  }}
                />
              </div>

              {screenshotNotice && <p className="mt-2 text-xs text-amber-600">{screenshotNotice}</p>}

              {screenshots.length > 0 && (
                <>
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {screenshots.map((entry, index) => (
                      <div
                        key={`${entry.file.name}-${entry.file.lastModified}-${index}`}
                        className="group relative aspect-square overflow-hidden rounded border border-line-soft"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={entry.previewUrl} alt={`Screenshot ${index + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeScreenshot(index)}
                          aria-label={`Remove screenshot ${index + 1}`}
                          className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    {screenshots.length} of {MAX_SCREENSHOTS} screenshots selected.
                  </p>
                </>
              )}
            </FieldWrapper>

            <FormMessage state={manualState} />
            <SubmitButton pendingLabel="Extracting...">Extract from pasted content</SubmitButton>
          </form>

          <div className="border-t border-line-soft pt-4">
            <Link
              href="/admin/properties/new"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-moss-700 hover:underline"
            >
              Continue to manual property creation <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
