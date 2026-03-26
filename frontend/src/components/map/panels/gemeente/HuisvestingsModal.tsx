import { ExternalLink } from 'lucide-react'
import { AMBER, SLATE_MUTED } from '@/lib/tokens'
import { GemeenteModal } from './GemeenteModal'
import { useHuisvestingsverordening } from '@/hooks/useHuisvestingsverordening'

interface HuisvestingsModalProps {
  gemeenteNaam: string
  onClose: () => void
}

export function HuisvestingsModal({ gemeenteNaam, onClose }: HuisvestingsModalProps) {
  const { data: hvvData, isLoading } = useHuisvestingsverordening(gemeenteNaam)

  const active = hvvData?.heeft_verordening ?? false

  return (
    <GemeenteModal
      title="Huisvestingsverordening"
      subtitle={active ? 'Splitsingsverordening actief' : 'Geen huisvestingsverordening'}
      onClose={onClose}
    >
      {isLoading && <p className="text-[13px] text-slate-400 text-center py-8">Laden...</p>}

      {!isLoading && (
        <div className="space-y-6">
          {/* Status card */}
          <div
            className="rounded-[16px] p-5"
            style={{
              background: active ? 'rgba(249, 168, 38, 0.06)' : '#F8FAF9',
              border: active ? '1px solid rgba(249, 168, 38, 0.2)' : '1px solid #EAEFEF',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                style={{
                  color: active ? AMBER.base : SLATE_MUTED,
                  backgroundColor: active ? 'rgba(249, 168, 38, 0.1)' : '#f0f2f1',
                }}
              >
                {active ? 'ACTIEF' : 'NIET AANWEZIG'}
              </span>
            </div>

            <p className="text-[13px] text-slate-600 leading-relaxed">
              {active
                ? 'Deze gemeente heeft een huisvestingsverordening. Dit betekent extra regels voor woningsplitsing, kamerverhuur en onttrekking aan de woningvoorraad. U heeft een vergunning nodig voor het splitsen van een woning of het omzetten naar kamerverhuur.'
                : 'Deze gemeente heeft geen huisvestingsverordening. Splitsing en kamerverhuur volgen de standaard regels. Let op: dit kan veranderen — check regelmatig de Officiële Bekendmakingen.'
              }
            </p>
          </div>

          {/* Document link */}
          {hvvData?.title && (
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase mb-2" style={{ letterSpacing: '0.2em' }}>
                Document
              </h3>
              <div className="bg-[#F8FAF9] rounded-[14px] px-4 py-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#0E1111] line-clamp-2 flex-1">
                  {hvvData.title}
                </span>
                {hvvData.url && (
                  <a
                    href={hvvData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-8 w-8 rounded-full bg-white text-slate-400 hover:text-[#F9A826] transition-colors shrink-0 ml-3"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* What it means */}
          {active && (
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase mb-2" style={{ letterSpacing: '0.2em' }}>
                Wat betekent dit?
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Woningsplitsing', desc: 'Vergunningplichtig — splitsen van zelfstandige woonruimte' },
                  { label: 'Kamerverhuur', desc: 'Vergunningplichtig — omzetting naar onzelfstandige woonruimte' },
                  { label: 'Onttrekking', desc: 'Vergunningplichtig — woning omzetten naar andere functie' },
                ].map((item) => (
                  <div key={item.label} className="bg-[#F8FAF9] rounded-[12px] px-4 py-3">
                    <span className="text-[12px] font-bold text-[#0E1111] block">{item.label}</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GemeenteModal>
  )
}
