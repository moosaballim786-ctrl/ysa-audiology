import { Suspense } from "react";
import { SettingsView } from "@/components/features/settings/settings-view";
import { ListSkeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <SettingsView />
    </Suspense>
  );
}
