import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parse as parseTld } from "tldts"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
