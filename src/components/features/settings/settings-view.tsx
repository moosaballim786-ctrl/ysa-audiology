"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarClock, Code2, MessageCircle, Repeat, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { PracticeSection } from "./practice-section";
import { HoursSection } from "./hours-section";
import { RecallTypesSection } from "./recall-types-section";
import { WhatsAppSection } from "./whatsapp-section";
import { StaffSection } from "./staff-section";
import { BookingLinkSection } from "./booking-link-section";

const SECTIONS = [
  { id: "practice", label: "Practice", icon: Building2 },
  { id: "hours", label: "Hours & booking", icon: CalendarClock },
  { id: "recalls", label: "Recall plans", icon: Repeat },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "staff", label: "Staff", icon: Users },
  { id: "booking", label: "Booking page", icon: Code2 },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsView() {
  const params = useSearchParams();
  const router = useRouter();
  const [section, setSection] = useState<SectionId>((params.get("s") as SectionId) || "practice");

  function go(id: SectionId) {
    setSection(id);
    router.replace(`/settings?s=${id}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader label="Settings" title="Settings" subtitle="Practice details, hours, recall plans, WhatsApp, staff and the booking page." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:px-0" aria-label="Settings sections">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.id === section;
            return (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-2.5 rounded-xl px-3.5 text-[14px] font-medium transition",
                  active ? "bg-primary-soft text-primary-hover" : "text-text hover:bg-[#eef2f5]",
                )}
              >
                <Icon className="size-[18px]" /> {s.label}
              </button>
            );
          })}
        </nav>
        <div className="min-w-0">
          {section === "practice" && <PracticeSection />}
          {section === "hours" && <HoursSection />}
          {section === "recalls" && <RecallTypesSection />}
          {section === "whatsapp" && <WhatsAppSection />}
          {section === "staff" && <StaffSection />}
          {section === "booking" && <BookingLinkSection />}
        </div>
      </div>
    </div>
  );
}
