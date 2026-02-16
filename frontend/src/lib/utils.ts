import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes without conflicts.
 * Combines clsx (conditional classes) with tailwind-merge (deduplication).
 * Use this in ALL component className props.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
