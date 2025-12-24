import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Clean display name by removing phone numbers if present
 * Preserves original data - only cleans for display purposes
 * 
 * Examples:
 * "+40721967846 Magda Joy" -> "Magda Joy"
 * "0765457608 John Doe" -> "John Doe"
 * "Regular Name" -> "Regular Name"
 * 
 * @param {string} name - Original name from database
 * @returns {string} - Cleaned name for display
 */
export function cleanDisplayName(name) {
  if (!name) return name;
  
  // Pattern to match phone numbers at the start of the name
  // Matches: +40..., 0040..., 40..., 0...
  const phonePattern = /^[\+]?[\d\s\-\(\)\.]+\s+/;
  
  // Remove phone number from the beginning
  const cleaned = name.replace(phonePattern, '').trim();
  
  // If cleaning resulted in empty string, return original
  return cleaned || name;
}
