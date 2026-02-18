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
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5 text-grey-400" />
        <h2 className="text-lg font-semibold text-grey-100">Meldingen</h2>
      </div>
      <p className="mb-6 text-sm text-grey-400">
        Ontvang e-mailmeldingen bij wijzigingen in je gemonitorde gebieden
      </p>

      {isLoading ? (
        <Skeleton className="h-6 w-40" />
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm text-grey-100">E-mailmeldingen</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs?.notification_email_alerts ?? false}
            onClick={handleToggle}
            className={[
              'relative inline-flex h-6 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
              'transition-colors duration-200 ease-in-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-accent focus-visible:ring-offset-2 focus-visible:ring-offset-grey-950',
              prefs?.notification_email_alerts
                ? 'bg-teal-accent'
                : 'bg-grey-700',
            ].join(' ')}
          >
            <span
              className={[
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
                'transform transition duration-200 ease-in-out',
                prefs?.notification_email_alerts
                  ? 'translate-x-4'
                  : 'translate-x-0',
              ].join(' ')}
            />
          </button>
        </div>
      )}
    </section>
  )
}
