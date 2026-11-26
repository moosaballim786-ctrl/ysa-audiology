import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingFlow } from "@/components/features/book/booking-flow";

export const metadata: Metadata = {
  title: "Book an appointment",
  description: "Book a hearing assessment or wax removal with Yusuf Suder Audiology. We're hear for you.",
};

export default function BookPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-24 h-96 max-w-xl skeleton" />}>
      <BookingFlow />
    </Suspense>
  );
}
