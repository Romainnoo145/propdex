/**
 * AiSummaryCard — wraps a parsed AI summary in a contract-conform
 * SectionInsightCard. Replaces the violet custom div previously used
 * in configuratie.tsx. Amber-on-obsidian styling comes automatically
 * from SectionInsightCard — this component does not pick colors.
 */
import { Sparkles } from "lucide-react";
import { SectionInsightCard } from "@/components/reports/components/SectionInsightCard";
import { SubCard, KVRow } from "@/components/reports/components";
import type { DocumentSummary } from "@/hooks/usePolicyDocuments";

interface Props {
  summary: DocumentSummary;
  documentName: string;
}

export function AiSummaryCard({ summary, documentName }: Props) {
  const hasKeyFacts = summary.key_facts.length > 0;
  const extractedEntries = Object.entries(summary.extracted_values);
  const hasExtracted = extractedEntries.length > 0;

  return (
    <SectionInsightCard
      kicker="AI-samenvatting"
      title={documentName}
      Icon={Sparkles}
    >
      <p className="text-[13px] leading-relaxed text-slate-500">
        {summary.summary}
      </p>

      {hasKeyFacts && (
        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
            Kerncijfers
          </p>
          <ul className="space-y-1.5">
            {summary.key_facts.map((fact) => (
              <li
                key={fact}
                className="flex items-start gap-2 text-[12px] text-slate-500"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-aura-amber shrink-0" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasExtracted && (
        <div className="mt-4">
          <SubCard>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">
              Uitgelichte waarden
            </p>
            {extractedEntries.map(([label, value]) => (
              <KVRow key={label} label={label} value={value} />
            ))}
          </SubCard>
        </div>
      )}
    </SectionInsightCard>
  );
}
