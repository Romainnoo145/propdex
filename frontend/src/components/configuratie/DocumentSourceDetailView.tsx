/**
 * DocumentSourceDetailView — shared shell for configuratie document
 * source detail views. Works at all 3 entity levels (gemeente /
 * provincie / landelijk) via the entityType prop.
 *
 * Owns all data fetching and state. Sub-components are pure
 * presentational units that receive props and render.
 *
 * Implements contract §1 (layout), §10 (state containers via shared
 * DetailStates), and composes SectionInsightCard from the reports
 * contract components.
 */
import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import {
  usePolicyDocuments,
  parseAiSummary,
  type PolicyDocument,
  type DocumentSummary,
} from "@/hooks/usePolicyDocuments";
import { SectionInsightCard } from "@/components/reports/components/SectionInsightCard";
import { PDFViewerModal } from "@/components/ui/PDFViewerModal";
import { DetailLoading, DetailEmpty, DetailError } from "./DetailStates";
import { SourceGuidanceCard } from "./SourceGuidanceCard";
import { DocumentUploadZone } from "./DocumentUploadZone";
import { DocumentListItem } from "./DocumentListItem";
import { AiSummaryCard } from "./AiSummaryCard";

interface Props {
  entityType: "gemeente" | "provincie" | "landelijk";
  entityCode: string;
  sourceKey: string;
}

export function DocumentSourceDetailView({
  entityType,
  entityCode,
  sourceKey,
}: Props) {
  const { user } = useAuth();
  const isSuperuser = user?.is_superuser ?? false;

  const [polling, setPolling] = useState(false);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);

  const { data, isLoading, error } = usePolicyDocuments(
    entityType,
    entityCode,
    sourceKey,
    true,
    polling ? 3000 : false,
  );

  const documents = data?.documents ?? [];
  const isAnyParsing = documents.some((d) => d.status === "parsing");

  useEffect(() => {
    setPolling(isAnyParsing);
  }, [isAnyParsing]);

  const firstSummary = useMemo<{
    summary: DocumentSummary;
    document: PolicyDocument;
  } | null>(() => {
    for (const doc of documents) {
      const parsed = parseAiSummary(doc.ai_summary);
      if (parsed) return { summary: parsed, document: doc };
    }
    return null;
  }, [documents]);

  const viewingDoc = documents.find((d) => d.id === viewingDocId) ?? null;
  const viewingUrl = viewingDoc
    ? `${import.meta.env.VITE_API_URL ?? ""}/api/policy-documents/${entityType}/${entityCode}/${viewingDoc.id}`
    : null;

  if (isLoading) return <DetailLoading />;
  if (error) return <DetailError error={error as Error} />;

  return (
    <div
      className="space-y-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <SourceGuidanceCard sourceKey={sourceKey} />

      {isSuperuser && (
        <DocumentUploadZone
          entityType={entityType}
          entityCode={entityCode}
          sourceKey={sourceKey}
        />
      )}

      {firstSummary && (
        <AiSummaryCard
          summary={firstSummary.summary}
          documentName={firstSummary.document.filename}
        />
      )}

      {documents.length > 0 && (
        <SectionInsightCard
          kicker="Documenten"
          title="Geüploade bestanden"
          Icon={FileText}
          badge={`${documents.length}`}
        >
          {documents.map((doc) => (
            <DocumentListItem
              key={doc.id}
              document={doc}
              onView={() => setViewingDocId(doc.id)}
              isSuperuser={isSuperuser}
            />
          ))}
        </SectionInsightCard>
      )}

      {documents.length === 0 && !isSuperuser && (
        <DetailEmpty message="Nog geen document toegevoegd voor deze bron." />
      )}

      {viewingDoc && viewingUrl && (
        <PDFViewerModal
          url={viewingUrl}
          title={viewingDoc.filename}
          onClose={() => setViewingDocId(null)}
        />
      )}
    </div>
  );
}
