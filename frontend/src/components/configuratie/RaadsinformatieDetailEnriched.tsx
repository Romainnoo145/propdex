/**
 * Enriched Raadsinformatie detail for the configuratie source-detail view.
 *
 * Follows CONFIGURATIE-DESIGN-CONTRACT.md strictly:
 * - SectionInsightCard wrappers
 * - TimelineRow-style list items (contract §6)
 * - Neutral bg-[#F8FAFA] type pills (contract §5)
 * - space-y-6 top-level with Plus Jakarta font
 */
import { useState, useMemo } from "react";
import {
  useRaadsinformatie,
  type RaadsstukResponse,
} from "@/hooks/useRaadsinformatie";
import { FileText, ExternalLink, Search } from "lucide-react";
import { DetailLoading, DetailEmpty, DetailError } from "./DetailStates";
import { SectionInsightCard } from "@/components/reports/components";

interface Props {
  gemeenteNaam: string | null;
}

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return dateFmt.format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

/* ─── Stuk list item (contract §6: TimelineRow) ──────────────── */

function StukItem({
  stuk,
  idx,
  total,
}: {
  stuk: RaadsstukResponse;
  idx: number;
  total: number;
}) {
  return (
    <div className="flex gap-3 py-3 border-b border-[#EAEFEF] last:border-b-0">
      <div className="flex flex-col items-center pt-1.5">
        <span className="h-2 w-2 rounded-full bg-aura-amber shrink-0" />
        {idx < total - 1 && <span className="w-px flex-1 bg-[#EAEFEF] mt-1" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[#0E1111] leading-snug line-clamp-2">
          {stuk.bron_url ? (
            <a
              href={stuk.bron_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-aura-amber transition-colors"
            >
              {stuk.titel}
            </a>
          ) : (
            stuk.titel
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {stuk.datum && <span>{formatDate(stuk.datum)}</span>}
          {stuk.type && (
            <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px]">
              {stuk.type}
            </span>
          )}
          {stuk.bron_url && (
            <a
              href={stuk.bron_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-slate-400 hover:text-[#0E1111]"
            >
              <ExternalLink size={9} />
            </a>
          )}
        </div>
        {stuk.samenvatting && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400 line-clamp-2">
            {stuk.samenvatting}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */

export function RaadsinformatieDetailEnriched({ gemeenteNaam }: Props) {
  const { data, isLoading, error } = useRaadsinformatie(gemeenteNaam);
  const [searchQuery, setSearchQuery] = useState("");

  const stukken = data?.stukken;
  const filteredStukken = useMemo(() => {
    if (!stukken) return [];
    if (!searchQuery.trim()) return stukken;
    const q = searchQuery.trim().toLowerCase();
    return stukken.filter(
      (s) =>
        s.titel.toLowerCase().includes(q) ||
        (s.samenvatting && s.samenvatting.toLowerCase().includes(q)) ||
        (s.type && s.type.toLowerCase().includes(q)),
    );
  }, [stukken, searchQuery]);

  if (!gemeenteNaam || isLoading) return <DetailLoading />;
  if (error) return <DetailError error={error as Error} />;
  if (!data || data.stukken.length === 0)
    return <DetailEmpty message="Geen raadsstukken gevonden." />;

  // Type counts for summary pills
  const typeCounts: Record<string, number> = {};
  for (const stuk of data.stukken) {
    const t = stuk.type || "Overig";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const sortedTypes = Object.entries(typeCounts).sort(([, a], [, b]) => b - a);

  return (
    <div
      className="space-y-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Main card */}
      <SectionInsightCard
        kicker="Raadsinformatie"
        title={`${data.total_found} stukken`}
        Icon={FileText}
        badge={data.dekking ? "Goede dekking" : "Beperkte dekking"}
      >
        {/* Type summary — neutral pills per contract §5 */}
        {sortedTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {sortedTypes.map(([type, count]) => (
              <span
                key={type}
                className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px]"
              >
                {type} ({count})
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        {data.stukken.length > 5 && (
          <div className="relative mb-4">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek in raadsstukken..."
              className="w-full rounded-[12px] border border-[#EAEFEF] bg-white py-2.5 pl-9 pr-4 text-[13px] text-[#0E1111] placeholder:text-slate-300 outline-none focus:border-slate-300 transition-colors"
            />
          </div>
        )}

        {/* Stukken feed */}
        {filteredStukken.length > 0 ? (
          <div className="max-h-[480px] overflow-y-auto">
            {filteredStukken.map((stuk, idx) => (
              <StukItem
                key={stuk.doc_id}
                stuk={stuk}
                idx={idx}
                total={filteredStukken.length}
              />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-slate-400">
            Geen resultaten voor deze zoekopdracht.
          </p>
        )}
      </SectionInsightCard>
    </div>
  );
}
