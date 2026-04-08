/**
 * SourceGuidanceCard — renders the contextual explainer, relevance
 * and checklist for a configuratie source, wrapped in the contract's
 * standard SectionInsightCard shell.
 *
 * Data comes from sourceGuidance.ts. If the sourceKey has no entry,
 * the component renders null (the caller decides the fallback).
 */
import { BookOpen, CheckCircle2 } from "lucide-react";
import { SectionInsightCard } from "@/components/reports/components/SectionInsightCard";
import { SOURCE_GUIDANCE } from "./sourceGuidance";

interface Props {
  sourceKey: string;
}

export function SourceGuidanceCard({ sourceKey }: Props) {
  const guidance = SOURCE_GUIDANCE[sourceKey];
  if (!guidance) return null;

  return (
    <SectionInsightCard
      kicker="Uitleg"
      title="Wat is dit document?"
      Icon={BookOpen}
    >
      <p className="text-[13px] leading-relaxed text-slate-500">
        {guidance.explainer}
      </p>

      <div className="mt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
          Relevant voor vastgoedontwikkeling
        </p>
        <p className="text-[13px] leading-relaxed text-slate-500">
          {guidance.relevance}
        </p>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
          Checklist
        </p>
        <ul className="space-y-1.5">
          {guidance.checklist.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-[12px] text-slate-500"
            >
              <CheckCircle2
                size={14}
                className="mt-0.5 shrink-0 text-emerald-500"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionInsightCard>
  );
}
