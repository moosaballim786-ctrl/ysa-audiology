"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Ear,
  Home,
  LogOut,
  ScanLine,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { YsaBadge } from "@/components/brand/logo";
import { CountBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { sb } from "@/lib/supabase/client";
import { useApp } from "./app-context";

const TOP = [
  { href: "/", label: "Home", icon: Home },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
];

const BOTTOM = [
  { href: "/takings", label: "Takings", icon: Wallet },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/patients", label: "Patient History", short: "Patients", icon: Users },
  { href: "/ent", label: "ENT Patients", short: "ENT", icon: Ear },
  { href: "/notifications", label: "Notifications", short: "Alerts", icon: Bell },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function TopBar() {
  const pathname = usePathname();
  const { staff, pendingRequests } = useApp();
  const router = useRouter();

  async function signOut() {
    await sb().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="glass sticky top-0 z-40 border-b border-border/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-full pr-1" aria-label="Yusuf Suder Audiology — Home">
          <YsaBadge className="size-9" />
          <span className="hidden font-display text-[15px] font-semibold tracking-tight text-heading lg:block">
            Yusuf Suder Audiology
          </span>
        </Link>

        <nav className="ml-1 flex items-center gap-1" aria-label="Primary">
          {TOP.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex h-10 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition-colors",
                  active ? "text-primary-hover" : "text-muted hover:text-heading",
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="top-pill"
                    className="absolute inset-0 rounded-full bg-primary-soft"
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  />
                )}
                <Icon className="relative size-[18px]" strokeWidth={2} />
                <span className="relative">{item.label}</span>
                {item.href === "/" && pendingRequests > 0 && <CountBadge count={pendingRequests} className="relative bg-amber" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/settings"
            aria-label="Settings"
            className={cn(
              "flex size-10 items-center justify-center rounded-full transition-colors",
              isActive(pathname, "/settings") ? "bg-primary-soft text-primary-hover" : "text-muted hover:bg-[#eef2f5] hover:text-heading",
            )}
          >
            <Settings className="size-[19px]" />
          </Link>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="flex items-center gap-1 rounded-full p-1 pr-2 transition hover:bg-[#eef2f5]" aria-label="Account">
                <Avatar name={staff?.full_name} className="size-8 text-[12px]" />
                <ChevronDown className="hidden size-4 text-muted sm:block" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={8}
                className="z-50 w-64 rounded-2xl border border-border bg-card p-2 shadow-float data-[state=open]:animate-[fadeIn_.15s_ease-out]"
              >
                <div className="px-3 py-2.5">
                  <div className="font-display text-[15px] font-semibold text-heading">{staff?.full_name}</div>
                  <div className="text-[13px] capitalize text-muted">{staff?.role}</div>
                </div>
                <div className="my-1 h-px bg-border" />
                <Link href="/settings" className="flex h-11 items-center gap-2.5 rounded-xl px-3 text-[14px] hover:bg-bg-alt">
                  <Settings className="size-4 text-muted" /> Settings
                </Link>
                <button
                  onClick={signOut}
                  className="flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[14px] text-coral-text hover:bg-coral-bg"
                >
                  <LogOut className="size-4" /> Sign out
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>
    </header>
  );
}

export function BottomBar() {
  const pathname = usePathname();
  const { unread } = useApp();
  return (
    <nav
      aria-label="Sections"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/90 backdrop-blur-xl md:inset-x-auto md:bottom-5 md:left-1/2 md:-translate-x-1/2 md:rounded-[22px] md:border md:pb-0 md:shadow-float"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around px-1 md:gap-1 md:px-2 md:py-2">
        {BOTTOM.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition-colors md:h-12 md:flex-row md:gap-2 md:px-4 md:text-[13.5px]",
                  active ? "text-primary-hover" : "text-muted hover:text-heading",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-pill"
                    className="absolute inset-x-1.5 inset-y-1.5 rounded-2xl bg-primary-soft md:inset-0 md:rounded-[14px]"
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  />
                )}
                <span className="relative">
                  <Icon className="size-[21px] md:size-[18px]" strokeWidth={active ? 2.2 : 1.9} />
                  {item.href === "/notifications" && unread > 0 && (
                    <CountBadge count={unread} className="absolute -right-2.5 -top-2" />
                  )}
                </span>
                <span className="relative whitespace-nowrap">
                  <span className="md:hidden">{item.short ?? item.label}</span>
                  <span className="hidden md:inline">{item.label}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
