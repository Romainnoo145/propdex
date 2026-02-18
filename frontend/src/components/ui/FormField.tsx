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
        className="block text-sm font-medium text-grey-100"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        {...registration}
        className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm text-grey-100 placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-amber-accent ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-grey-800'
        }`}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error.message}</p>
      )}
    </div>
  )
}
