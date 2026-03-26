import { CreditCard } from 'lucide-react'

export function SubscriptionSection() {
  return (
    <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-5">
      <div className="flex items-center gap-2">
        <CreditCard size={14} className="text-[#F9A826]" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E1111]">
          Abonnement
        </p>
      </div>

      <div className="rounded-[16px] bg-[#F9A826]/10 border border-[#F9A826]/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-[#0E1111]">Pro</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Onbeperkt scans & rapporten</p>
          </div>
          <span className="rounded-full bg-[#F9A826] px-3 py-1 text-[10px] font-bold text-[#0E1111]">
            Actief
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-slate-500">Verlengdatum</span>
          <span className="text-[12px] font-semibold text-[#0E1111] tabular-nums">1 april 2026</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-slate-500">Betaalmethode</span>
          <span className="text-[12px] font-semibold text-[#0E1111]">•••• 4242</span>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 italic">
        Facturatie en abonnementsbeheer binnenkort beschikbaar
      </p>
    </div>
  )
}
