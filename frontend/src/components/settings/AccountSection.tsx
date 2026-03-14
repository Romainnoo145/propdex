import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { BentoPod } from '@/components/primitives/BentoPod'
import { useAuth } from '@/lib/auth/useAuth'
import { useUpdateProfile } from '@/hooks/useSettings'

const accountSchema = z.object({
  full_name: z.string().min(1, 'Naam is verplicht').max(255),
  email: z.string().email('Ongeldig e-mailadres'),
})

type AccountFormData = z.infer<typeof accountSchema>

export function AccountSection() {
  const { user, updateUser } = useAuth()
  const { mutateAsync: updateProfile } = useUpdateProfile()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
    },
  })

  const onSubmit = async (data: AccountFormData) => {
    try {
      const updatedUser = await updateProfile(data)
      updateUser(updatedUser)
      toast.success('Profiel opgeslagen')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fout bij opslaan')
    }
  }

  return (
    <BentoPod size="spacious" className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-aura-amber" />
        <h2 className="text-lg font-semibold text-aura-ink">Account</h2>
      </div>
      <p className="text-sm text-neutral-600">
        Beheer je naam en e-mailadres
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="full_name" className="block text-sm font-medium text-aura-ink">
            Naam
          </label>
          <Input
            id="full_name"
            type="text"
            autoComplete="name"
            {...register('full_name')}
          />
          {errors.full_name && (
            <p className="text-xs text-error">{errors.full_name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="account_email" className="block text-sm font-medium text-aura-ink">
            E-mailadres
          </label>
          <Input
            id="account_email"
            type="email"
            autoComplete="email"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-error">{errors.email.message}</p>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!isDirty || isSubmitting}
          >
            {isSubmitting ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </div>
      </form>
    </BentoPod>
  )
}
