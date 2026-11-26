import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  label,
  title,
  subtitle,
  action,
  className,
}: {
  label?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {label && <div className="label-caps mb-1.5">{label}</div>}
        <h1 className="text-[28px] font-bold leading-[1.15] sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function SectionLabel({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 mt-8 flex items-center justify-between", className)}>
      <h2 className="label-caps">{children}</h2>
      {action}
    </div>
  );
}
