/**
 * Enriched Vergunning-klimaat detail for the configuratie source-detail view.
 *
 * Reuses shared report components: SectionInsightCard, SubCard, KVRow, StatCell.
 */
import {
  useGemeenteProfile,
  SEVERITY_COLORS,
} from "@/hooks/useGemeenteProfile";
import { Shield, ArrowRight } from "lucide-react";
import { DetailLoading, DetailEmpty, DetailError } from "./DetailStates";
import {
  SectionInsightCard,
  SubCard,
  KVRow,
  StatCell,
} from "@/components/reports/components";

interface Props {
  gemeenteNaam: string | null;
}

export function VergunningKlimaatDetailEnriched({ gemeenteNaam }: Props) {
  const { data: profile, isLoading, error } = useGemeenteProfile(gemeenteNaam);

  if (!gemeenteNaam || isLoading) return <DetailLoading />;
  if (error) return <DetailError error={error as Error} />;
  if (!profile) return <DetailEmpty message="Geen data beschikbaar." />;
  if (profile.data_coverage === 'none') {
    return (
      <DetailEmpty
        message="Geen vergunningdata beschikbaar"
        description="Voor deze gemeente zijn nog geen vergunningen verwerkt. Probeer een andere gemeente of kijk later terug."
      />
    );
  }

  const sevColor =
    SEVERITY_COLORS[profile.severity_label] ?? SEVERITY_COLORS["Onbekend"];
  const permitEntries = Object.entries(profile.permit_type_distribution ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);
  const maxCount = permitEntries.length > 0 ? (permitEntries[0]![1] ?? 1) : 1;

  return (
    <div
      className="space-y-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Main card — reuses SectionInsightCard from rapport sections */}
      <SectionInsightCard
        kicker="Vergunningklimaat"
        title={profile.severity_label}
        Icon={Shield}
        badge={`${profile.sample_size} zaken`}
      >
        {/* Severity indicator bar */}
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: sevColor }}
            />
            <span className="text-[11px] font-semibold text-slate-600">
              {profile.severity_label}
            </span>
          </span>
          <span className="text-[11px] text-slate-400">
            op basis van {profile.sample_size} vergunningen
          </span>
        </div>

        {/* Core metrics — reuses StatCell from rapport */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCell
            label="Goedkeuring"
            value={
              profile.approval_rate_pct != null
                ? `${profile.approval_rate_pct.toFixed(1)}%`
                : "—"
            }
          />
          <StatCell
            label="Afwijzing"
            value={
              profile.rejection_rate_pct != null
                ? `${profile.rejection_rate_pct.toFixed(1)}%`
                : "—"
            }
          />
          <StatCell
            label="Doorlooptijd"
            value={
              profile.avg_doorlooptijd_days != null
                ? `${Math.round(profile.avg_doorlooptijd_days)}d`
                : "—"
            }
          />
        </div>

        {/* Key-value details — reuses KVRow */}
        <KVRow
          label="Bekendmakingen 30d"
          value={String(profile.bekendmakingen_30d)}
        />
        <KVRow
          label="Bekendmakingen 90d"
          value={String(profile.bekendmakingen_90d)}
        />
        <KVRow
          label="Bekendmakingen 365d"
          value={String(profile.bekendmakingen_365d)}
        />
      </SectionInsightCard>

      {/* Permit type distribution — uses SubCard */}
      {permitEntries.length > 0 && (
        <SubCard>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">
            Vergunningtype verdeling
          </p>
          <div className="space-y-2.5">
            {permitEntries.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="w-[140px] truncate text-[12px] text-slate-500">
                  {type}
                </span>
                <div className="flex-1 h-[6px] rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#F9A826]"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[12px] font-bold text-[#0E1111] tabular-nums">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </SubCard>
      )}

      {/* Link */}
      <SubCard>
        <a
          href="/meldingen"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#B07D18] hover:underline"
        >
          Bekijk alle bekendmakingen
          <ArrowRight size={14} />
        </a>
      </SubCard>
    </div>
  );
}
