/**
 * DocumentListItem — one row per uploaded policy document.
 *
 * Renders filename, version, upload timestamp, parse status, view,
 * download, and (superuser-only) delete with confirmation dialog.
 */
import { useState } from "react";
import { Eye, Download, FileText, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { useDeletePolicyDocument } from "@/hooks/usePolicyDocuments";
import type { PolicyDocument } from "@/hooks/usePolicyDocuments";

interface Props {
  document: PolicyDocument;
  onView: () => void;
  isSuperuser?: boolean;
}

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatUploadDate(iso: string): string {
  try {
    return dateFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusPill(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    ready: {
      label: "Verwerkt",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    parsed: {
      label: "Verwerkt",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    parsing: {
      label: "Verwerken…",
      cls: "border-amber-200 bg-amber-50 text-amber-700",
    },
    error: {
      label: "Fout",
      cls: "border-red-200 bg-red-50 text-red-700",
    },
  };
  const entry = map[status] ?? {
    label: status,
    cls: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${entry.cls}`}
    >
      {entry.label}
    </span>
  );
}

function DeleteConfirmDialog({
  filename,
  onConfirm,
  onCancel,
  isPending,
}: {
  filename: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-[#0E1111]/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        className="relative z-10 w-[420px] rounded-[28px] bg-white p-8 shadow-2xl"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-red-50">
          <AlertTriangle size={22} className="text-red-500" />
        </div>

        <h3 className="mb-2 text-[18px] font-black tracking-tight text-[#0E1111]">
          Document verwijderen?
        </h3>
        <p className="mb-1 text-[13px] text-slate-500 leading-relaxed">
          Je staat op het punt om het volgende document permanent te verwijderen:
        </p>
        <p className="mb-6 rounded-xl bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-700 truncate">
          {filename}
        </p>

        <p className="mb-6 text-[12px] text-slate-400">
          Deze actie kan niet ongedaan worden gemaakt. De AI-analyse wordt ook verwijderd.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-2xl border border-slate-200 py-3 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-2xl bg-red-500 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {isPending ? "Verwijderen…" : "Ja, verwijder"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentListItem({ document: doc, onView, isSuperuser = false }: Props) {
  const { accessToken } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const deleteMutation = useDeletePolicyDocument();

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken) return;
    const url = `${import.meta.env.VITE_API_URL ?? ""}/api/policy-documents/${doc.entity_type}/${doc.entity_code}/${doc.id}`;
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        if (!res.ok) throw new Error(`Download mislukt (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = blobUrl;
        a.download = doc.filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch((err) => {
        console.error("[DocumentListItem] download failed:", err);
      });
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate(
      { entityType: doc.entity_type, entityCode: doc.entity_code, documentId: doc.id },
      { onSettled: () => setShowConfirm(false) },
    );
  };

  return (
    <>
      <div className="flex items-center gap-3 py-3 border-b border-[#EAEFEF] last:border-b-0">
        <FileText size={16} className="shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#0E1111] leading-snug truncate">
            {doc.filename}
          </p>
          <p className="text-[11px] text-slate-400">
            v{doc.version_number} · Geüpload {formatUploadDate(doc.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusPill(doc.status)}
          <button
            onClick={onView}
            className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0E1111]"
            title="Bekijk PDF"
            type="button"
          >
            <Eye className="size-3.5" />
          </button>
          <button
            onClick={handleDownload}
            className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0E1111]"
            title="Download PDF"
            type="button"
          >
            <Download className="size-3.5" />
          </button>
          {isSuperuser && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
              className="flex size-7 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
              title="Verwijder document"
              type="button"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {showConfirm && (
        <DeleteConfirmDialog
          filename={doc.filename}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowConfirm(false)}
          isPending={deleteMutation.isPending}
        />
      )}
    </>
  );
}
