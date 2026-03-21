import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Key, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/primitives/Input'
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
    <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Key size={14} className="text-[#F9A826]" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E1111]">
          Wachtwoord
        </p>
      </div>

      {!isEmailUser ? (
        <p className="text-[13px] text-slate-500">
          Wachtwoord wordt beheerd via Google
        </p>
      ) : (
        <>
          <p className="text-[13px] text-slate-500">
            Wijzig je wachtwoord
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="current_password" className="block text-[12px] font-semibold text-[#0E1111]">
                Huidig wachtwoord
              </label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                {...register('current_password')}
              />
              {errors.current_password && (
                <p className="text-[11px] text-red-500">{errors.current_password.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new_password" className="block text-[12px] font-semibold text-[#0E1111]">
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
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-[#0E1111]"
                  aria-label={showNewPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                >
                  {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.new_password && (
                <p className="text-[11px] text-red-500">{errors.new_password.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm_password" className="block text-[12px] font-semibold text-[#0E1111]">
                Bevestig wachtwoord
              </label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                {...register('confirm_password')}
              />
              {errors.confirm_password && (
                <p className="text-[11px] text-red-500">{errors.confirm_password.message}</p>
              )}
            </div>
            <div className="flex justify-start">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-[#0E1111] px-5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
              >
                {isSubmitting ? 'Opslaan...' : 'Wachtwoord wijzigen'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
