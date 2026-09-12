'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const controlBase =
  'w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-colors ' +
  'placeholder:text-slate-400 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        controlBase,
        'h-9',
        type === 'file' &&
          'h-auto cursor-pointer py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent-foreground hover:file:bg-blue-100',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlBase, 'min-h-20 py-2', className)} {...props} />
  )
)
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(controlBase, 'h-9 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
    </div>
  )
)
Select.displayName = 'Select'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-sm font-medium text-slate-700', className)} {...props} />
}

export interface FormFieldProps {
  label: React.ReactNode
  required?: boolean
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/** Label + control + optional hint, with consistent spacing. */
export function FormField({ label, required, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'size-4 shrink-0 rounded border-input text-primary accent-[var(--primary)] focus:ring-2 focus:ring-ring/30',
        className
      )}
      {...props}
    />
  )
)
Checkbox.displayName = 'Checkbox'

/** A selectable chip used for multi-select lists like positions. */
export function CheckChip({
  checked,
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { checked: boolean }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
        checked
          ? 'border-primary bg-accent text-accent-foreground'
          : 'border-border bg-card text-slate-700 hover:bg-slate-50',
        className
      )}
      {...props}
    >
      {children}
    </label>
  )
}
