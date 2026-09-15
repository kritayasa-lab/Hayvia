import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  wrapperClassName?: string;
}

/**
 * Standalone labeled text input, built on FormField's FieldWrapper/TextInput
 * so it shares the same field styling as every other form in the app.
 * Pass `icon` for a leading icon (e.g. search fields).
 */
export default function Input({
  label,
  hint,
  error,
  icon,
  wrapperClassName,
  className,
  id,
  name,
  required,
  ...props
}: InputProps) {
  const inputId = id ?? name;

  const control = icon ? (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-matcha-mist">
        {icon}
      </span>
      <TextInput
        id={inputId}
        name={name}
        required={required}
        error={Boolean(error)}
        className={cn("pl-10", className)}
        {...props}
      />
    </div>
  ) : (
    <TextInput
      id={inputId}
      name={name}
      required={required}
      error={Boolean(error)}
      className={className}
      {...props}
    />
  );

  if (!label) return control;

  return (
    <FieldWrapper
      label={label}
      htmlFor={inputId ?? ""}
      required={required}
      hint={hint}
      error={error}
      className={wrapperClassName}
    >
      {control}
    </FieldWrapper>
  );
}
