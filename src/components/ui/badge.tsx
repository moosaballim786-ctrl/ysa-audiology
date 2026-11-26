import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "teal" | "blue" | "amber" | "sage" | "coral" | "slate";

const tones: Record<Tone, string> = {
  teal: "bg-primary-soft text-primary-hover",
  blue: "bg-secondary-soft text-secondary",
  amber: "bg-amber-bg text-amber-text",
  sage: "bg-sage-bg text-sage-text",
  coral: "bg-coral-bg text-coral-text",
  slate: "bg-[#eef2f5] text-[#475569]",
};
const dots: Record<Tone, string> = {
  teal: "bg-primary",
  blue: "bg-secondary",
  amber: "bg-amber",
  sage: "bg-sage",
  coral: "bg-coral",
  slate: "bg-[#94a3b8]",
};

export function Pill({
  tone = "slate",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-semibold leading-5",
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "tnum inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral px-1 text-[10.5px] font-bold leading-none text-white ring-2 ring-card",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
