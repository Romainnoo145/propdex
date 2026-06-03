/**
 * BriefCard — M052/S04 Contact brief-teaser.
 *
 * Genereert een gepersonaliseerde acquisitiebrief uit echte data:
 *   - mode 'auto'   → rechtspersoon/overheid-BRK-record aanwezig (NAW auto).
 *   - mode 'manual' → geen record: aanhef + adres handmatig invulbaar.
 *
 * Versturen-actie (fake PostNL-send) is alléén zichtbaar voor de hauzer_demo-org;
 * backend dwingt de gate eveneens af (403). M051 swapt de FakeBriefDispatcher
 * 1-op-1 voor de echte PostNL-dispatcher.
 */
import { useState } from 'react'
import { useAuth } from '@/lib/auth/useAuth'
import { useBrkRecords } from '@/hooks/useBrkRecords'
import { useGenerateBrief, useSendBrief } from '@/hooks/useBrief'
import { deriveBriefMode } from './deriveBriefMode'

export function BriefCard({ parcelId }: { parcelId: string }) {
  const { user } = useAuth()
  const { data: records } = useBrkRecords(parcelId)
  const mode = deriveBriefMode({ hasBrkRecord: (records?.length ?? 0) > 0 })
  const gen = useGenerateBrief(parcelId)
  const send = useSendBrief(parcelId)
  const [aanhef, setAanhef] = useState('')
  const [adres, setAdres] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <div className="bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px] p-6 mb-4">
      <h3 className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-3">
        Persoonlijke brief
      </h3>

      {mode === 'manual' && (
        <div className="space-y-2 mb-3">
          <input
            value={aanhef}
            onChange={(e) => setAanhef(e.target.value)}
            placeholder="Geachte heer/mevrouw …"
            className="w-full rounded-[12px] border border-[#EAEFEF] px-3 py-2 text-[13px]"
          />
          <input
            value={adres}
            onChange={(e) => setAdres(e.target.value)}
            placeholder="NAW geadresseerde"
            className="w-full rounded-[12px] border border-[#EAEFEF] px-3 py-2 text-[13px]"
          />
        </div>
      )}

      <button
        onClick={() =>
          gen.mutate(
            mode === 'manual'
              ? { eigenaar_aanhef: aanhef, eigenaar_adres: adres }
              : undefined,
          )
        }
        disabled={gen.isPending}
        className="rounded-full bg-aura-obsidian px-4 py-2 text-[12px] font-semibold text-white mb-3 disabled:opacity-60"
      >
        {gen.isPending ? 'Genereren…' : 'Genereer brief'}
      </button>

      {gen.data && (
        <pre className="whitespace-pre-wrap text-[13px] text-aura-ink bg-white rounded-[16px] border border-[#EAEFEF] p-4">
          {gen.data.markdown}
        </pre>
      )}

      {gen.data &&
        user?.hauzer_demo &&
        (sent ? (
          <p className="mt-3 text-[13px] font-semibold text-aura-amber-hover">Verzonden ✓</p>
        ) : (
          <button
            onClick={() =>
              send.mutate(gen.data!.markdown, { onSuccess: () => setSent(true) })
            }
            disabled={send.isPending}
            className="mt-3 rounded-full border border-aura-amber/40 bg-aura-amber/[0.12] px-4 py-2 text-[12px] font-semibold text-aura-amber-hover disabled:opacity-60"
          >
            {send.isPending ? 'Versturen…' : 'Versturen'}
          </button>
        ))}
    </div>
  )
}
