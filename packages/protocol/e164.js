/**
 * Aegis Protocol - International E.164 Phone Normalization & Country Data
 * Standard compliance: ITU-T E.164
 */

export const COUNTRY_DATA = [
  { name: 'United States', iso: 'US', code: '+1', flag: '🇺🇸', minLen: 10, maxLen: 10, format: '(###) ###-####' },
  { name: 'Canada', iso: 'CA', code: '+1', flag: '🇨🇦', minLen: 10, maxLen: 10, format: '(###) ###-####' },
  { name: 'United Kingdom', iso: 'GB', code: '+44', flag: '🇬🇧', minLen: 10, maxLen: 10, format: '#### ######' },
  { name: 'India', iso: 'IN', code: '+91', flag: '🇮🇳', minLen: 10, maxLen: 10, format: '##### #####' },
  { name: 'Germany', iso: 'DE', code: '+49', flag: '🇩🇪', minLen: 10, maxLen: 11, format: '### #######' },
  { name: 'France', iso: 'FR', code: '+33', flag: '🇫🇷', minLen: 9, maxLen: 9, format: '# ## ## ## ##' },
  { name: 'Japan', iso: 'JP', code: '+81', flag: '🇯🇵', minLen: 10, maxLen: 10, format: '## #### ####' },
  { name: 'Australia', iso: 'AU', code: '+61', flag: '🇦🇺', minLen: 9, maxLen: 9, format: '### ### ###' },
  { name: 'Brazil', iso: 'BR', code: '+55', flag: '🇧🇷', minLen: 10, maxLen: 11, format: '## #####-####' },
  { name: 'Switzerland', iso: 'CH', code: '+41', flag: '🇨🇭', minLen: 9, maxLen: 9, format: '## ### ## ##' },
  { name: 'Singapore', iso: 'SG', code: '+65', flag: '🇸🇬', minLen: 8, maxLen: 8, format: '#### ####' },
  { name: 'United Arab Emirates', iso: 'AE', code: '+971', flag: '🇦🇪', minLen: 9, maxLen: 9, format: '## ### ####' },
  { name: 'South Korea', iso: 'KR', code: '+82', flag: '🇰🇷', minLen: 9, maxLen: 10, format: '## #### ####' },
  { name: 'Netherlands', iso: 'NL', code: '+31', flag: '🇳🇱', minLen: 9, maxLen: 9, format: '## ########' },
  { name: 'Sweden', iso: 'SE', code: '+46', flag: '🇸🇪', minLen: 9, maxLen: 9, format: '## ### ## ##' }
];

/**
 * Normalizes an international phone number to canonical E.164 format (+[country code][subscriber number]).
 * Removes whitespace, dashes, parens, and leading zeros from national destination code.
 *
 * @param {string} rawInput - e.g. "+1 (555) 234-5678" or "07123 456789" with country code
 * @param {string} defaultCallingCode - optional fallback calling code, e.g. "+1" or "+91"
 * @returns {{ valid: boolean, e164: string, country?: object, error?: string }}
 */
export function normalizePhoneNumber(rawInput, defaultCallingCode = '+1') {
  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, e164: '', error: 'Phone number string is required' };
  }

  let cleaned = rawInput.trim();

  // If number starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // Strip all characters except digits and leading +
  const hasPlus = cleaned.startsWith('+');
  const digitsOnly = cleaned.replace(/\D/g, '');

  if (!digitsOnly || digitsOnly.length < 6) {
    return { valid: false, e164: '', error: 'Phone number is too short' };
  }

  let matchedCountry = null;
  let nationalNumber = '';

  if (hasPlus) {
    // Match against country codes, longest prefix first
    const sortedCountries = [...COUNTRY_DATA].sort((a, b) => b.code.length - a.code.length);
    for (const c of sortedCountries) {
      const numericCode = c.code.replace('+', '');
      if (digitsOnly.startsWith(numericCode)) {
        matchedCountry = c;
        nationalNumber = digitsOnly.substring(numericCode.length);
        break;
      }
    }

    if (!matchedCountry) {
      // Generic fallback for any valid international code between 1 and 3 digits
      if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
        return {
          valid: true,
          e164: `+${digitsOnly}`,
          country: { name: 'International', code: `+${digitsOnly.substring(0, 3)}`, flag: '🌐' }
        };
      }
      return { valid: false, e164: '', error: 'Unsupported or invalid international calling code' };
    }
  } else {
    // Use default calling code
    matchedCountry = COUNTRY_DATA.find(c => c.code === defaultCallingCode) || COUNTRY_DATA[0];
    nationalNumber = digitsOnly;
  }

  // Strip leading national trunk prefix '0' if present (common in UK, Germany, France, etc.)
  if (nationalNumber.startsWith('0')) {
    nationalNumber = nationalNumber.replace(/^0+/, '');
  }

  // Validate length against country rules
  if (nationalNumber.length < matchedCountry.minLen || nationalNumber.length > matchedCountry.maxLen) {
    return {
      valid: false,
      e164: '',
      error: `Invalid length for ${matchedCountry.name}. Expected between ${matchedCountry.minLen} and ${matchedCountry.maxLen} digits.`
    };
  }

  const e164 = `${matchedCountry.code}${nationalNumber}`;

  // ITU-T E.164 max length is 15 digits (excluding +)
  if (e164.length < 8 || e164.length > 16) {
    return { valid: false, e164: '', error: 'Number exceeds ITU-T E.164 length constraints' };
  }

  return {
    valid: true,
    e164,
    country: matchedCountry
  };
}
