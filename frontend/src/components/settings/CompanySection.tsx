import { Building2 } from 'lucide-react'

export function CompanySection() {
  return (
    <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Building2 size={14} className="text-[#F9A826]" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E1111]">
          Bedrijfsgegevens
        </p>
      </div>
      <p className="text-[13px] text-slate-500">
        Informatie over je organisatie
      </p>

      <div className="space-y-4">
        <Field label="Bedrijfsnaam" placeholder="Nog niet ingesteld" />
        <Field label="KvK-nummer" placeholder="Nog niet ingesteld" />
        <Field label="Adres" placeholder="Nog niet ingesteld" />
        <Field label="Telefoon" placeholder="Nog niet ingesteld" />
        <Field label="Website" placeholder="Nog niet ingesteld" />
      </div>

      <p className="text-[11px] text-slate-300 italic">
        Bedrijfsgegevens zijn binnenkort bewerkbaar
      </p>
    </div>
  )
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[12px] font-semibold text-[#0E1111]">{label}</p>
      <div className="rounded-[12px] bg-[#F2F6F3] px-3.5 py-2.5 text-[13px] text-slate-400">
        {placeholder}
      </div>
    </div>
  )
}
