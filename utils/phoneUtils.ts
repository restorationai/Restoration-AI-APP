/**
 * Restoration AI - Phone Number Utilities
 * Handles conversion between E.164 (Storage) and Formatted (Display).
 */

/**
 * Converts a formatted string or raw digits to E.164 format.
 * Example: (805) 555-1212 -> +18055551212
 */
export const toE164 = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  
  // US/Canada normalization
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  
  // Already E.164 or international
  return phone.startsWith('+') ? phone : `+${digits}`;
};

/**
 * Converts an E.164 string to a display-friendly format.
 * Example: +18055551212 -> (805) 555-1212
 */
export const toDisplay = (phone: string): string => {
  if (!phone) return '';
  
  let digits = phone.replace(/\D/g, '');
  
  // Remove US country code for local formatting
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.substring(1);
  }
  
  // If we have 10 digits, format with mask
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  
  // Fallback for non-standard numbers
  return phone;
};

/**
 * Used for live input masking as the user types.
 */
export const formatPhoneNumberInput = (value: string): string => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '').slice(0, 10);
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};
