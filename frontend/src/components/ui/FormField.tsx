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
  const errorId = `${id}-error`

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[12px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...registration}
        className={`block w-full rounded-[14px] border bg-[#F8FAF9] px-4 py-3 text-[14px] text-[#0E1111] placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#F9A826] focus:border-transparent transition-shadow ${
          error
            ? 'border-red-400 focus:ring-red-400'
            : 'border-[#EAEFEF]'
        }`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-[12px] text-red-500">{error.message}</p>
      )}
    </div>
  )
}
