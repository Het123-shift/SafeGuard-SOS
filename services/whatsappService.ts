import { Linking, Platform } from 'react-native';

/**
 * Normalizes any phone number to E.164 format (digits only, with country code).
 * Defaults to India (+91) if no country code is present.
 *
 * @param phone Raw phone number string from user input or database
 * @param defaultCountryCode Default international dialing code without '+' (e.g. '91')
 * @returns Normalized E.164 digits string or null if invalid
 */
export function normalizePhoneNumberToE164(
  phone: string,
  defaultCountryCode: string = '91'
): string | null {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Strip all non-digit characters except '+'
  let cleaned = phone.trim().replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // 11-digit number starting with 0 (e.g., 09876543210 in India) -> prepend country code
    cleaned = `${defaultCountryCode}${cleaned.substring(1)}`;
  } else if (cleaned.length === 10) {
    // 10-digit standard Indian mobile number without country code
    cleaned = `${defaultCountryCode}${cleaned}`;
  }

  // E.164 requires 10 to 15 digits
  const isValid = /^[0-9]{10,15}$/.test(cleaned);
  if (!isValid) {
    console.warn(`[WhatsAppService] Phone number failed E.164 validation: "${phone}" -> "${cleaned}"`);
    return null;
  }

  return cleaned;
}

/**
 * Builds a valid wa.me deep-link URL.
 * Format: https://wa.me/<E164_NUMBER>?text=<URL_ENCODED_MESSAGE>
 *
 * @param phone Raw or normalized phone number
 * @param message Emergency SOS message string
 * @param defaultCountryCode Default country code (default '91')
 * @returns Complete URL string or null if phone number is invalid
 */
export function buildWhatsAppDeepLink(
  phone: string,
  message: string,
  defaultCountryCode: string = '91'
): string | null {
  const normalizedNumber = normalizePhoneNumberToE164(phone, defaultCountryCode);
  if (!normalizedNumber) {
    return null;
  }

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalizedNumber}?text=${encodedMessage}`;
}

/**
 * Opens WhatsApp chat via wa.me deep-link using Intent(ACTION_VIEW) via Linking.openURL.
 * Wrapped in try/catch — fails silently (logs warning) if WhatsApp is not installed.
 *
 * @param phone Target contact phone number
 * @param message Message to pre-fill
 * @returns true if opened successfully, false otherwise
 */
export async function openWhatsAppDeepLink(
  phone: string,
  message: string,
  defaultCountryCode: string = '91'
): Promise<boolean> {
  const url = buildWhatsAppDeepLink(phone, message, defaultCountryCode);
  if (!url) {
    console.warn(`[WhatsAppService] Skipping invalid phone number: ${phone}`);
    return false;
  }

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
      return true;
    }

    const supported = await Linking.canOpenURL(url).catch(() => true);
    if (supported) {
      await Linking.openURL(url);
      return true;
    } else {
      console.warn(`[WhatsAppService] Cannot open URL or WhatsApp not installed: ${url}`);
      return false;
    }
  } catch (error) {
    console.warn(`[WhatsAppService] Failed to open WhatsApp deep-link for ${phone}:`, error);
    return false;
  }
}

/**
 * Automatically triggers WhatsApp deep-link for the FIRST valid contact in priority list.
 * Only opens 1 chat automatically to avoid broken stacking UX on Android.
 *
 * @param contacts Array of contact objects containing phone numbers
 * @param message SOS message string
 * @returns The phone number of the contact that was opened, or null if none
 */
export async function openWhatsAppForFirstContact(
  contacts: Array<{ phone: string; name?: string }>,
  message: string
): Promise<string | null> {
  for (const contact of contacts) {
    const success = await openWhatsAppDeepLink(contact.phone, message);
    if (success) {
      console.log(`[WhatsAppService] Auto-opened WhatsApp deep-link for first contact: ${contact.name || contact.phone}`);
      return contact.phone;
    }
  }
  return null;
}
