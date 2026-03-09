import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Key, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { useAuth } from '@/lib/auth/useAuth'
import { useChangePassword } from '@/hooks/useSettings'

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Vul het huidige wachtwoord in'),
    new_password: z.string().min(8, 'Minimaal 8 tekens'),
    confirm_password: z.string().min(1, 'Bevestig het wachtwoord'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Wachtwoorden komen niet overeen',
    path: ['confirm_password'],
  })

type PasswordFormData = z.infer<typeof passwordSchema>

export function PasswordSection() {
  const { user } = useAuth()
  const { mutateAsync: changePassword } = useChangePassword()
  const [showNewPassword, setShowNewPassword] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  const onSubmit = async (data: PasswordFormData) => {
    try {
      await changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      })
      toast.success('Wachtwoord gewijzigd')
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fout bij wijzigen')
    }
  }

  const isEmailUser = user?.auth_provider === 'email'

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Key className="h-5 w-5 text-neutral-600" />
        <h2 className="text-lg font-semibold text-aura-ink">Wachtwoord</h2>
      </div>

      {!isEmailUser ? (
        <p className="text-sm text-neutral-600">
          Wachtwoord wordt beheerd via Google
        </p>
      ) : (
        <>
          <p className="mb-6 text-sm text-neutral-600">
            Wijzig je wachtwoord
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="current_password"
                className="block text-sm font-medium text-aura-ink"
              >
                Huidig wachtwoord
              </label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                {...register('current_password')}
              />
              {errors.current_password && (
                <p className="text-xs text-error">
                  {errors.current_password.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="new_password"
                className="block text-sm font-medium text-aura-ink"
              >
                Nieuw wachtwoord
              </label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-10"
                  {...register('new_password')}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-600 hover:text-aura-ink"
                  aria-label={showNewPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.new_password && (
                <p className="text-xs text-error">
                  {errors.new_password.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="confirm_password"
                className="block text-sm font-medium text-aura-ink"
              >
                Bevestig wachtwoord
              </label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                {...register('confirm_password')}
              />
              {errors.confirm_password && (
                <p className="text-xs text-error">
                  {errors.confirm_password.message}
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Opslaan...' : 'Wachtwoord wijzigen'}
              </Button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}
