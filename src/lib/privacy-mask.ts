/**
 * Privacy Utility for TRANA
 * 
 * Direct unmasked transmission as requested: Numbers and contact details
 * are preserved without replacement.
 */

export function maskConfidentialPatterns(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text;
}
