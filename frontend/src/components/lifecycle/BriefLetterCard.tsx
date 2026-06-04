/**
 * BriefLetterCard — fase-2 "Persoonlijke brief" card.
 *
 * Faithful rebuild of Contact.html §3 (.brief2 two-column: .briefacts | .letter).
 * Replaces the old BriefCard "Genereer brief"-button + raw-markdown-in-a-box UX.
 *
 * Layout:
 *   LEFT  (.briefacts): "Acties" label + 3 buttons (Versturen primary · Bewerken
 *          + Download PDF disabled stubs) + .anote.
 *   RIGHT (.letter): styled letter "paper" — letterhead (.lh / .lh-logo / .lh-meta)
 *          from useAfzender, .naw addressee block (BRK auto / manual inputs),
 *          .pd date, .betreft, body paragraphs (generated markdown), .groet.
 *
 * Auto-generates on mount via useGenerateBrief (no separate click). The generated
 * markdown supplies the LETTER BODY; the chrome (letterhead/NAW/betreft/groet) is
 * laid out as distinct styled blocks from afzender + eigenaar data per the mockup.
 *
 * Versturen is gated on user?.hauzer_demo (backend enforces 403 too); shows
 * "Verzonden ✓" after send.
 */
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Mail, FileText, Download } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import { useAfzender, useGenerateBrief, useSendBrief } from '@/hooks/useBrief'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

export interface BriefLetterCardProps {
  parcelId: string
  /** Auto-modus eigenaar (rechtspersoon/overheid) of null voor particulier (manual). */
  record: BRKOwnershipRecordRead | null
}

/** "Venlo, 29 mei 2026"-stijl datumregel. */
function formatLetterDate(d: Date): string {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function BriefLetterCard({ parcelId, record }: BriefLetterCardProps) {
  const { user } = useAuth()
  const { data: afzender } = useAfzender()
  const gen = useGenerateBrief(parcelId)
  const send = useSendBrief(parcelId)

  const isManual = record === null

  // Manual-mode NAW inputs (particulier) — feed the .naw block + generate payload.
  const [manualAanhef, setManualAanhef] = useState('')
  const [manualAdres, setManualAdres] = useState('')
  const [sent, setSent] = useState(false)
  // Logo-slot: degrade to text-wordmark when /images/hauzer-partners-logo.svg ontbreekt.
  const [logoFailed, setLogoFailed] = useState(false)

  // Auto-generate on mount (auto-modus) — particulier wacht op handmatige NAW.
  useEffect(() => {
    if (!isManual) {
      gen.mutate(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelId, isManual])

  const handleManualGenerate = () => {
    setSent(false)
    gen.mutate({ eigenaar_aanhef: manualAanhef, eigenaar_adres: manualAdres })
  }

  // Letterhead (afzender)
  const bedrijfsnaam = afzender?.bedrijfsnaam ?? 'Uw organisatie'
  const afzenderAdres = afzender?.afzender_adres ?? null
  const contactEmail = afzender?.contact_email ?? null
  const contactTelefoon = afzender?.contact_telefoon ?? null

  // NAW addressee
  const nawNaam = isManual ? manualAanhef.trim() : (record?.eigenaar_naam ?? '')
  const nawAdres = isManual ? manualAdres.trim() : (record?.statutaire_zetel ?? '')

  const today = formatLetterDate(new Date())
  const canSend = Boolean(user?.hauzer_demo) && Boolean(gen.data)

  return (
    <div className="bg-white/60 backdrop-blur-[24px] border border-white/50 rounded-[24px] px-[26px] py-6 mb-4 shadow-[0_1px_2px_rgba(14,17,17,0.03),0_8px_24px_rgba(14,17,17,0.04)]">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[16px] font-bold text-aura-ink">Persoonlijke brief</h2>
        <span className="text-[13px] font-bold text-aura-ink">
          Automatisch opgesteld · concept
        </span>
      </div>

      {/* brief2 — two columns: acties | letter */}
      <div className="mt-[14px] grid grid-cols-[212px_1fr] items-start gap-[22px] max-lg:grid-cols-1">
        {/* briefacts (left) */}
        <div className="flex flex-col gap-[7px]">
          <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500">
            Acties
          </div>

          {isManual ? (
            <>
              <input
                value={manualAanhef}
                onChange={(e) => setManualAanhef(e.target.value)}
                placeholder="Naam geadresseerde"
                className="h-9 w-full rounded-[9px] border border-[#E5E7EB] bg-white px-3 text-[13px] text-aura-ink focus:border-aura-amber focus:outline-none focus:ring-[3px] focus:ring-aura-amber/[0.12]"
              />
              <input
                value={manualAdres}
                onChange={(e) => setManualAdres(e.target.value)}
                placeholder="Adres geadresseerde"
                className="h-9 w-full rounded-[9px] border border-[#E5E7EB] bg-white px-3 text-[13px] text-aura-ink focus:border-aura-amber focus:outline-none focus:ring-[3px] focus:ring-aura-amber/[0.12]"
              />
              <button
                type="button"
                onClick={handleManualGenerate}
                disabled={gen.isPending}
                className="flex h-9 w-full items-center justify-center gap-[7px] rounded-[9px] bg-aura-amber text-[13px] font-semibold text-aura-obsidian hover:bg-aura-amber-hover disabled:opacity-60"
              >
                <FileText size={14} strokeWidth={1.7} />
                {gen.isPending ? 'Genereren…' : 'Stel brief op'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!gen.data) return
                send.mutate(gen.data.markdown, { onSuccess: () => setSent(true) })
              }}
              disabled={!canSend || send.isPending || sent}
              className="flex h-9 w-full items-center justify-center gap-[7px] rounded-[9px] bg-aura-amber text-[13px] font-semibold text-aura-obsidian hover:bg-aura-amber-hover disabled:opacity-60"
            >
              <Mail size={14} strokeWidth={1.7} />
              {sent ? 'Verzonden ✓' : send.isPending ? 'Versturen…' : 'Versturen'}
            </button>
          )}

          <button
            type="button"
            disabled
            className="flex h-9 w-full cursor-not-allowed items-center justify-center gap-[7px] rounded-[9px] border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#374151] opacity-60"
          >
            <FileText size={14} strokeWidth={1.7} className="text-slate-600" />
            Bewerken
          </button>
          <button
            type="button"
            disabled
            className="flex h-9 w-full cursor-not-allowed items-center justify-center gap-[7px] rounded-[9px] border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#374151] opacity-60"
          >
            <Download size={14} strokeWidth={1.7} className="text-slate-600" />
            Download PDF
          </button>

          <div className="mt-2 text-[11px] leading-[1.55] text-slate-400">
            Opgesteld uit de BRK-eigenaar + perceelintelligentie (potentie, woonvisie). Verzending
            en opvolging worden vastgelegd in Realworks.
          </div>
        </div>

        {/* letter (right) — A4 paper sheet (210 × 297 mm → ratio 1 : 1.414).
            min-h houdt de A4-ratio als ondergrens: korte brieven ogen als een
            volle pagina, lange brieven groeien mee zodat niets clipt. */}
        <div className="flex justify-center">
          <div className="flex w-full min-h-[calc((100%_*_297)/210)] max-w-[660px] flex-col rounded-[3px] border border-[#E5E9E9] bg-white px-14 py-16 text-[13.5px] leading-[1.7] text-aura-ink shadow-[0_2px_16px_rgba(14,17,17,0.06)]">
            {/* lh — letterhead: afzender-meta LINKS, logo RECHTSBOVEN */}
            <div className="flex items-start justify-between gap-6 border-b border-[#E5E9E9] pb-6">
              <div className="text-[10.5px] leading-[1.6] text-slate-400">
                {bedrijfsnaam}
                {afzenderAdres && (
                  <>
                    <br />
                    {afzenderAdres}
                  </>
                )}
                {(contactEmail || contactTelefoon) && (
                  <>
                    <br />
                    {[contactEmail, contactTelefoon].filter(Boolean).join(' · ')}
                  </>
                )}
              </div>
              {logoFailed ? (
                <span className="shrink-0 text-[18px] font-extrabold tracking-tight text-aura-obsidian">
                  {bedrijfsnaam}
                </span>
              ) : (
                <img
                  src="/images/hauzer-partners-logo.jpg"
                  alt={bedrijfsnaam}
                  className="h-12 w-auto shrink-0"
                  onError={() => setLogoFailed(true)}
                />
              )}
            </div>

            {/* naw — addressee */}
            {(nawNaam || nawAdres) && (
              <div className="mt-12 whitespace-pre-line">
                {[nawNaam, nawAdres].filter(Boolean).join('\n')}
              </div>
            )}

            {/* pd — date (rechts uitgelijnd, NL-conventie) */}
            <div className="mt-8 text-right text-slate-600">
              {afzenderAdres ? deriveCity(afzenderAdres) : 'Venlo'}, {today}
            </div>

            {/* body (generated markdown) — betreft + paragraphs (geen groet meer:
                de afsluiter rendert de frontend onderaan de A4) */}
            <div className="mt-8">
              {gen.isPending && (
                <p className="text-slate-400">De brief wordt automatisch opgesteld…</p>
              )}
              {gen.isError && (
                <p className="text-aura-red">
                  Brief kon niet worden opgesteld. Probeer opnieuw.
                </p>
              )}
              {gen.data && (
                <div className="[&_h1]:mb-[18px] [&_h1]:text-[14px] [&_h1]:font-bold [&_h2]:mb-[18px] [&_h2]:font-bold [&_p]:mb-[18px] [&_p]:leading-[1.75] [&_p:first-child]:mb-7 [&_strong]:font-semibold last:[&_p]:mb-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {gen.data.body}
                  </ReactMarkdown>
                </div>
              )}
              {!gen.data && !gen.isPending && !gen.isError && isManual && (
                <p className="text-slate-400">
                  Vul de geadresseerde links in en klik &ldquo;Stel brief op&rdquo;.
                </p>
              )}
            </div>

            {/* groet — afsluiter onderin de A4 (mt-auto duwt naar de bodem,
                pt-10 geeft lucht t.o.v. de body). Frontend-rendered uit afzender,
                niet meer uit de markdown-body. */}
            {gen.data && (
              <div className="mt-auto whitespace-pre-line pt-10 leading-[1.75]">
                {`Met vriendelijke groet,\n\n${afzender?.contactpersoon ?? ''}\n${bedrijfsnaam}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Best-effort stad uit een afzender-adres ("Postbus 412 · 5900 AK Venlo" → "Venlo"). */
function deriveCity(adres: string): string {
  const last = adres.split('·').pop()?.trim() ?? adres
  const parts = last.split(/\s+/)
  return parts[parts.length - 1] || 'Venlo'
}
