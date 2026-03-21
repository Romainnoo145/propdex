import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useUserPreferences, useUpdatePreferences } from '@/hooks/useSettings'

export function NotificationsSection() {
  const { data: prefs, isLoading } = useUserPreferences()
  const { mutate: updatePreferences } = useUpdatePreferences()

  const handleToggle = () => {
    if (!prefs) return
    updatePreferences(
      { notification_email_alerts: !prefs.notification_email_alerts },
      {
        onSuccess: () => toast.success('Voorkeuren opgeslagen'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Fout bij opslaan'),
      }
    )
  }

  return (
    <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bell size={14} className="text-[#F9A826]" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E1111]">
          Meldingen
        </p>
      </div>
      <p className="text-[13px] text-slate-500">
        Ontvang e-mailmeldingen bij wijzigingen in je gemonitorde gebieden
      </p>

      {isLoading ? (
        <Skeleton className="h-6 w-40" />
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#0E1111]">E-mailmeldingen</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs?.notification_email_alerts ?? false}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              prefs?.notification_email_alerts ? 'bg-[#F9A826]' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${
                prefs?.notification_email_alerts ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}
    </div>
  )
}
