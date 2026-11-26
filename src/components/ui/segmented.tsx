"use client";
import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cn("inline-flex rounded-[14px] border border-border bg-[#eef2f5]/70 p-1", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 rounded-[10px] px-3.5 font-medium transition-colors",
              size === "sm" ? "h-8 text-[13px]" : "h-9 text-sm",
              active ? "text-heading" : "text-muted hover:text-text",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[10px] bg-card shadow-[0_1px_2px_rgba(17,24,39,.06),0_2px_8px_-2px_rgba(17,24,39,.08)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Chips<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-all",
              active
                ? "border-primary/25 bg-primary-soft text-primary-hover"
                : "border-border bg-card text-text hover:border-[#d5dde5]",
            )}
          >
            {o.label}
            {o.count !== undefined && o.count > 0 && (
              <span className={cn("tnum text-[11px]", active ? "text-primary" : "text-muted")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
