import { Suspense } from "react";
import { PatientProfile } from "@/components/features/patients/patient-profile";
import { ListSkeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Patient" };

export default function PatientPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <PatientProfile />
    </Suspense>
  );
}
