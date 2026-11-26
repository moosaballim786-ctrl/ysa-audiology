import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { YsaBadge } from "@/components/brand/logo";

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <YsaBadge className="size-14 animate-pulse" />
        <div className="text-sm text-muted">We&rsquo;re hear for you</div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Splash />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
