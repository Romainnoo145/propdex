import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'

interface FormFieldProps {
  label: string
  id: string
  type?: string
  registration: UseFormRegisterReturn
  error?: FieldError
  placeholder?: string
  autoComplete?: string
}

export function FormField({
  label,
  id,
  type = 'text',
  registration,
  error,
  placeholder,
  autoComplete,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-aura-ink"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        {...registration}
        className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm text-aura-ink placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-aura-amber ${
          error
            ? 'border-error focus:ring-error'
            : 'border-neutral-200'
        }`}
      />
      {error && (
        <p className="mt-1 text-sm text-error">{error.message}</p>
      )}
    </div>
  )
}
