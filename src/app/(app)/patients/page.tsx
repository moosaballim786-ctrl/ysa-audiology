import { Suspense } from "react";
import { PatientList } from "@/components/features/patients/patient-list";
import { ListSkeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Patient History" };

export default function PatientsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <PatientList />
    </Suspense>
  );
}
