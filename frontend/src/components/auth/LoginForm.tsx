import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { FormField } from '../ui/FormField'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>
  onSuccess: () => void
}

export function LoginForm({ onLogin, onSuccess }: LoginFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setApiError(null)
    setIsSubmitting(true)

    try {
      await onLogin(data.email, data.password)
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
        <div className="rounded-[12px] bg-red-50 border border-red-200 p-3 text-[13px] text-red-600">
          {apiError}
        </div>
      )}

      <FormField
        label="Email"
        id="login-email"
        type="email"
        registration={register('email')}
        error={errors.email}
        placeholder="you@example.com"
        autoComplete="email"
      />

      <FormField
        label="Password"
        id="login-password"
        type="password"
        registration={register('password')}
        error={errors.password}
        placeholder="••••••••"
        autoComplete="current-password"
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-[14px] bg-[#F9A826] px-4 py-3 text-sm font-bold text-white hover:bg-[#E8971F] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  )
}
