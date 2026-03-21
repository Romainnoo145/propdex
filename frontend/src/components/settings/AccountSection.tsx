import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/primitives/Input'
import { useAuth } from '@/lib/auth/useAuth'
import { useUpdateProfile } from '@/hooks/useSettings'

const accountSchema = z.object({
  full_name: z.string().min(1, 'Naam is verplicht').max(255),
  email: z.string().email('Ongeldig e-mailadres'),
  phone: z.string().max(20).optional().or(z.literal('')),
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
      phone: '',
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
    <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-5">
      <div className="flex items-center gap-2">
        <User size={14} className="text-[#F9A826]" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E1111]">
          Account
        </p>
      </div>
      <p className="text-[13px] text-slate-500">
        Beheer je naam en e-mailadres
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="full_name" className="block text-[12px] font-semibold text-[#0E1111]">
            Naam
          </label>
          <Input
            id="full_name"
            type="text"
            autoComplete="name"
            {...register('full_name')}
          />
          {errors.full_name && (
            <p className="text-[11px] text-red-500">{errors.full_name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="account_email" className="block text-[12px] font-semibold text-[#0E1111]">
            E-mailadres
          </label>
          <Input
            id="account_email"
            type="email"
            autoComplete="email"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-[11px] text-red-500">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="phone" className="block text-[12px] font-semibold text-[#0E1111]">
            Telefoon
          </label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+31 6 12345678"
            {...register('phone')}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isDirty || isSubmitting}
            className="rounded-full bg-[#0E1111] px-5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
          >
            {isSubmitting ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </form>
    </div>
  )
}
