import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
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
  const [showPassword, setShowPassword] = useState(false)

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

      <div>
        <label
          htmlFor="login-password"
          className="block text-[12px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            {...register('password')}
            className={`block w-full rounded-[14px] border bg-[#F8FAF9] px-4 py-3 pr-11 text-[14px] text-[#0E1111] placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#F9A826] focus:border-transparent transition-shadow ${
              errors.password ? 'border-red-400 focus:ring-red-400' : 'border-[#EAEFEF]'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1 text-[12px] text-red-500">{errors.password.message}</p>
        )}
      </div>

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
