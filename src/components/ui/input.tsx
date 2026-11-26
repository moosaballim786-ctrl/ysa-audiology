import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-border bg-card px-3.5 text-[15px] text-heading placeholder:text-[#9aa6b5] shadow-[inset_0_1px_1px_rgba(17,24,39,.02)] transition-colors focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15 disabled:bg-bg-alt disabled:text-muted";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(base, "h-11", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, "min-h-[96px] py-3 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(base, "h-11 appearance-none pr-10", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
      >
        <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-text", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[13px] text-coral-text">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
