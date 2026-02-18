import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { FormField } from '../ui/FormField'
import type { RegisterData } from '../../lib/auth/types'

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  full_name: z.string().min(1, 'Full name is required'),
  organization_name: z.string().min(1, 'Company name is required'),
})

type RegisterFormData = z.infer<typeof registerSchema>

interface RegisterFormProps {
  onRegister: (data: RegisterData) => Promise<void>
  onSuccess: () => void
}

export function RegisterForm({ onRegister, onSuccess }: RegisterFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    setApiError(null)
    setIsSubmitting(true)

    try {
      await onRegister(data)
      onSuccess()
    } catch (error) {
      if (error instanceof Error) {
        setApiError(error.message)
      } else {
        setApiError('An unexpected error occurred')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {apiError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <FormField
        label="Email"
        id="register-email"
        type="email"
        registration={register('email')}
        error={errors.email}
        placeholder="you@example.com"
        autoComplete="email"
      />

      <FormField
        label="Password"
        id="register-password"
        type="password"
        registration={register('password')}
        error={errors.password}
        placeholder="••••••••"
        autoComplete="new-password"
      />

      <FormField
        label="Full Name"
        id="register-fullname"
        type="text"
        registration={register('full_name')}
        error={errors.full_name}
        placeholder="Jane Smith"
        autoComplete="name"
      />

      <FormField
        label="Company Name"
        id="register-organization"
        type="text"
        registration={register('organization_name')}
        error={errors.organization_name}
        placeholder="Your Company"
        autoComplete="organization"
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-amber-accent px-4 py-2 text-sm font-medium text-grey-950 hover:bg-amber-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  )
}
