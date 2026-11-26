import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[var(--radius-card)] border border-border bg-card shadow-soft", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  label,
  action,
  className,
}: {
  title?: React.ReactNode;
  label?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        {label && <div className="label-caps mb-1">{label}</div>}
        {title && <h3 className="text-[17px] font-semibold">{title}</h3>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
