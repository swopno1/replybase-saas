/**
 * Utility for extracting lead information (email, phone) from raw text
 * using robust regex patterns.
 */

export interface ExtractedLeadData {
  email?: string;
  phone?: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Robust phone regex (handles international, spaces, dashes, etc.)
const PHONE_REGEX = /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4,6})(?: *[x#]\d+)?/g;

export function extractLeadDataFromText(text: string): ExtractedLeadData {
  const data: ExtractedLeadData = {};

  // 1. Extract Email
  const emails = text.match(EMAIL_REGEX);
  if (emails && emails.length > 0) {
    // Take the first valid-looking email
    data.email = emails[0].toLowerCase();
  }

  // 2. Extract Phone
  const phones = text.match(PHONE_REGEX);
  if (phones && phones.length > 0) {
    // Only take it if it's long enough to be a real number (min 7 digits)
    const digitsOnly = phones[0].replace(/\D/g, "");
    if (digitsOnly.length >= 7) {
      data.phone = phones[0].trim();
    }
  }

  return data;
}
