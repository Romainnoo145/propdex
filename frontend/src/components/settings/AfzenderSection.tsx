/**
 * AfzenderSection — M052/S04 briefhoofd / afzender-instellingen.
 *
 * Vervangt de read-only CompanySection-placeholder. Bedrijfsnaam = org `name`
 * (read-only); adres/contactpersoon/e-mail/telefoon zijn bewerkbaar en voeden
 * het briefhoofd van de Contact-fase BriefCard.
 */
import { useRef, useState } from 'react'
import { Building2 } from 'lucide-react'
import { useAfzender, useSaveAfzender } from '@/hooks/useBrief'

const FIELDS = [
  { key: 'afzender_adres', label: 'Afzender-adres', placeholder: 'Postbus 412, 5900 AK Venlo' },
  { key: 'contactpersoon', label: 'Contactpersoon', placeholder: 'Voor- en achternaam' },
  { key: 'contact_email', label: 'Contact-e-mail', placeholder: 'info@bedrijf.nl' },
  { key: 'contact_telefoon', label: 'Telefoon', placeholder: '077 123 4567' },
] as const

type FieldKey = (typeof FIELDS)[number]['key']

export function AfzenderSection() {
  const { data } = useAfzender()
  const save = useSaveAfzender()
  // Edits live in `overrides`; the merge below seeds untouched fields from the
  // server payload during render (no setState-in-effect → no cascading renders).
  const [overrides, setOverrides] = useState<Partial<Record<FieldKey, string>>>({})
  // Transient "saved" flag: set on a successful save, auto-cleared after 2.5s.
  // Driven by the save handler (no setState-in-effect), so no cascading renders.
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const form: Record<FieldKey, string> = {
    afzender_adres: overrides.afzender_adres ?? data?.afzender_adres ?? '',
    contactpersoon: overrides.contactpersoon ?? data?.contactpersoon ?? '',
    contact_email: overrides.contact_email ?? data?.contact_email ?? '',
    contact_telefoon: overrides.contact_telefoon ?? data?.contact_telefoon ?? '',
  }

  return (
    <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Building2 size={14} className="text-[#F9A826]" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E1111]">
          Briefhoofd / afzender
        </p>
      </div>
      <p className="text-[13px] text-slate-500">
        Deze gegevens vullen het briefhoofd van persoonlijke brieven in de Contact-fase
      </p>

      <div className="space-y-1.5">
        <p className="text-[12px] font-semibold text-[#0E1111]">Bedrijfsnaam</p>
        <div className="rounded-[12px] bg-[#F2F6F3] px-3.5 py-2.5 text-[13px] text-slate-400">
          {data?.bedrijfsnaam ?? '—'}
        </div>
      </div>

      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <p className="text-[12px] font-semibold text-[#0E1111]">{f.label}</p>
            <input
              value={form[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setOverrides({ ...overrides, [f.key]: e.target.value })}
              className="w-full rounded-[12px] border border-[#EAEFEF] px-3.5 py-2.5 text-[13px] text-aura-ink"
            />
          </div>
        ))}
      </div>

      <button
        onClick={() =>
          save.mutate(form, {
            onSuccess: () => {
              setSaved(true)
              if (savedTimer.current) clearTimeout(savedTimer.current)
              savedTimer.current = setTimeout(() => setSaved(false), 2500)
            },
          })
        }
        disabled={save.isPending}
        className="rounded-full bg-aura-obsidian px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
      >
        {save.isPending ? 'Opslaan…' : 'Opslaan'}
      </button>
      {saved && (
        <p className="text-[11px] font-semibold text-aura-green-hover">Opgeslagen ✓</p>
      )}
    </div>
  )
}
