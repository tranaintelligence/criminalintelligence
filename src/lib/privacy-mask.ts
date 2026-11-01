/**
 * Privacy Masking Engine for TRANA
 * 
 * Enforces strict confidentiality between citizens and legal counsel:
 * - Automatically detects and masks phone numbers (formatted, international, or spaced).
 * - Detects and masks sequences of numbers (e.g. 4+ digits, spaced digits, comma-separated digits).
 * - Detects and masks Morse code patterns (dots, dashes, middle dots, em-dashes used for Morse evasion).
 * - Detects and masks spelled-out number sequences (e.g. "nine eight one zero...").
 * 
 * All matches are strictly replaced with "XXXXX".
 */

// Spelled-out number words in English and common transliterations
const NUMBER_WORDS_REGEX = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|chhe|saat|aath|nau|das)(?:\s+(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|chhe|saat|aath|nau|das)){3,}\b/gi;

// Morse code: Sequences of 3 or more morse letter-blocks composed of dots and dashes
// e.g. "... --- ...", "·-·· ·· --·", "-.-. .- .-.. .-..", ".-. ---"
const MORSE_CODE_REGEX = /(?:(?:^|\s)[.\-·•—_]{1,7}){3,}(?:\s|$)/g;

// Standard phone numbers with optional country code, brackets, hyphens, spaces, dots
// e.g. "+91 98110 42910", "98110-42910", "(011) 2338-1234", "9811042910"
const PHONE_NUMBER_REGEX = /(?:\+?\d{1,3}[-.\s]*)?\(?\d{2,4}\)?[-.\s]*\d{3,5}[-.\s]*\d{3,5}/g;

// Spaced or separated digits (evasion tactic: "9 8 1 1 0 4 2 9 1 0" or "9,8,1,1,0,4...")
const SPACED_DIGITS_REGEX = /\b\d(?:\s*[,.\-_/ ]\s*\d){3,}\b/g;

// Any continuous sequence of 4 or more digits
const DIGIT_SEQUENCE_REGEX = /\b\d{4,}\b/g;

// Email address pattern to mask accidental email sharing
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Masks all phone numbers, digit sequences, Morse code, and number words in text to "XXXXX".
 */
export function maskConfidentialPatterns(text: string): string {
  if (!text || typeof text !== "string") return text;

  let masked = text;

  // 1. Mask email addresses
  masked = masked.replace(EMAIL_REGEX, "XXXXX");

  // 2. Mask phone numbers
  masked = masked.replace(PHONE_NUMBER_REGEX, "XXXXX");

  // 3. Mask spaced digits (e.g. "9 8 1 1 0 4 2 9 1 0")
  masked = masked.replace(SPACED_DIGITS_REGEX, "XXXXX");

  // 4. Mask remaining digit sequences (4+ digits)
  masked = masked.replace(DIGIT_SEQUENCE_REGEX, "XXXXX");

  // 5. Mask Morse code patterns
  masked = masked.replace(MORSE_CODE_REGEX, (match) => {
    // Preserve edge spaces if present
    const lead = match.startsWith(" ") ? " " : "";
    const trail = match.endsWith(" ") ? " " : "";
    return `${lead}XXXXX${trail}`;
  });

  // 6. Mask spelled-out number sequences (e.g. "nine eight one zero...")
  masked = masked.replace(NUMBER_WORDS_REGEX, "XXXXX");

  // Collapse consecutive XXXXX markers for clean typography: "XXXXX XXXXX" -> "XXXXX"
  masked = masked.replace(/(?:XXXXX\s*){2,}/g, "XXXXX ");

  return masked.trimEnd();
}

