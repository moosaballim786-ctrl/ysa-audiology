import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-card/60 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-[22px]" strokeWidth={1.75} />
      </div>
      <div className="font-display text-[15px] font-semibold text-heading">{title}</div>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
