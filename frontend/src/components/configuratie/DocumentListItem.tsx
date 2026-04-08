/**
 * DocumentListItem — one row per uploaded policy document.
 *
 * Renders filename, upload timestamp, parse status (SemanticPill),
 * view button (opens PDFViewerModal via shell-owned state), download
 * button (fetches authenticated blob and triggers synthetic download).
 */
import { Eye, Download, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import type { PolicyDocument } from "@/hooks/usePolicyDocuments";

interface Props {
  document: PolicyDocument;
  onView: () => void;
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

export function DocumentListItem({ document: doc, onView }: Props) {
  const { accessToken } = useAuth();

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${import.meta.env.VITE_API_URL ?? ""}/api/policy-documents/${doc.entity_type}/${doc.entity_code}/${doc.id}`;
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = blobUrl;
        a.download = doc.filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#EAEFEF] last:border-b-0">
      <FileText size={16} className="shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[#0E1111] leading-snug truncate">
          {doc.filename}
        </p>
        <p className="text-[11px] text-slate-400">
          Geüpload {formatUploadDate(doc.created_at)}
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
      </div>
    </div>
  );
}
