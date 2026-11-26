import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function errorMessage(e: unknown): string {
  if (!e) return "Something went wrong";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong";
}
