/**
 * DocumentUploadZone — superuser-only drag-drop upload for a policy
 * document belonging to a given entity + source key.
 *
 * Owns local drag state. Calls useUploadPolicyDocument mutation.
 * The shell decides whether to render this component (superuser gate
 * lives in the shell, not here).
 *
 * The amber dashed border is an intentional exception to contract §2
 * — this is the Aura "action" styling for upload affordances, not a
 * generic neutral container. Matches the pattern from the original
 * configuratie.tsx upload zone at line 1569.
 */
import { useCallback, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { useUploadPolicyDocument } from "@/hooks/usePolicyDocuments";

interface Props {
  entityType: "gemeente" | "provincie" | "landelijk";
  entityCode: string;
  sourceKey: string;
}

export function DocumentUploadZone({
  entityType,
  entityCode,
  sourceKey,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const uploadMutation = useUploadPolicyDocument();

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      uploadMutation.mutate({ entityType, entityCode, sourceKey, file });
      e.target.value = "";
    },
    [entityType, entityCode, sourceKey, uploadMutation],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      uploadMutation.mutate({ entityType, entityCode, sourceKey, file });
    },
    [entityType, entityCode, sourceKey, uploadMutation],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center gap-3 rounded-[20px] border-2 border-dashed p-10 text-center transition-colors ${
          isDragging
            ? "border-aura-amber bg-amber-50/50"
            : "border-aura-amber/30 bg-amber-50/20"
        }`}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-amber-50">
          <Upload size={22} className="text-amber-600" />
        </div>
        <p className="text-[14px] font-bold text-[#0E1111]">
          Upload een document om AI-analyse te starten
        </p>
        <p className="text-[12px] text-slate-400">
          Sleep een bestand hierheen of klik op de knop
        </p>
        <button
          onClick={handleUploadClick}
          disabled={uploadMutation.isPending}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#0E1111] px-5 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          type="button"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Uploaden…
            </>
          ) : (
            <>
              <Upload size={14} />
              Kies bestand
            </>
          )}
        </button>
        <p className="text-[10px] text-slate-300">PDF, DOCX, XLSX, JPG, PNG</p>
        {uploadMutation.isError && (
          <p className="text-[12px] text-red-400">
            {uploadMutation.error?.message ?? "Upload mislukt"}
          </p>
        )}
      </div>
    </>
  );
}
