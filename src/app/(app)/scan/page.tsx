import { Suspense } from "react";
import { ScanFlow } from "@/components/features/scan/scan-flow";
import { ListSkeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Scan" };

export default function ScanPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <ScanFlow />
    </Suspense>
  );
}
