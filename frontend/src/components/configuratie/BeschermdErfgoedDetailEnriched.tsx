/**
 * Enriched Beschermd erfgoed detail for the configuratie source-detail view.
 *
 * Reuses shared report components: SectionInsightCard, SubCard.
 */
import { useErfgoed, type BeschermdGezichtResponse } from "@/hooks/useErfgoed";
import { Landmark } from "lucide-react";
import { DetailLoading, DetailEmpty, DetailError } from "./DetailStates";
import { SectionInsightCard } from "@/components/reports/components";

interface Props {
  gemeenteNaam: string | null;
}

/* ─── Gezicht list item — §6 TimelineRow pattern ────────────── */

function GezichtItem({
  gezicht,
  idx,
  total,
}: {
  gezicht: BeschermdGezichtResponse;
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
          {gezicht.naam}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {gezicht.type && (
            <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px]">
              {gezicht.type}
            </span>
          )}
          {gezicht.aangewezen && <span>Aangewezen: {gezicht.aangewezen}</span>}
          {gezicht.oppervlakte_ha != null && (
            <span>{gezicht.oppervlakte_ha} ha</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */

export function BeschermdErfgoedDetailEnriched({ gemeenteNaam }: Props) {
  const { data, isLoading, error } = useErfgoed(gemeenteNaam);

  if (!gemeenteNaam || isLoading) return <DetailLoading />;
  if (error) return <DetailError error={error as Error} />;

  const gezichten = data?.beschermde_gezichten ?? [];
  const total = data?.total ?? 0;

  if (total === 0) {
    return <DetailEmpty message="Geen beschermde gezichten gevonden." />;
  }

  return (
    <div
      className="space-y-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <SectionInsightCard
        kicker="Beschermd erfgoed"
        title="Beschermde gezichten"
        badge={`${total}`}
        Icon={Landmark}
      >
        <div className="max-h-[400px] overflow-y-auto">
          {gezichten.map((gezicht, i) => (
            <GezichtItem
              key={`${gezicht.naam}-${i}`}
              gezicht={gezicht}
              idx={i}
              total={gezichten.length}
            />
          ))}
        </div>
      </SectionInsightCard>
    </div>
  );
}
