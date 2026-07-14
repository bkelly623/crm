import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { roleLabel } from "@/lib/roles";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRole(role: string): string {
  return roleLabel(role);
}
