export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value.trim());
}

export function isValidPincode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

export function isValidUpiId(value: string): boolean {
  return /^[\w.-]+@[\w.-]+$/.test(value.trim());
}

export function isValidBankAccount(value: string): boolean {
  return /^\d{9,18}$/.test(value.trim());
}

export function isValidIfsc(value: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.trim().toUpperCase());
}

export function isPositiveNumber(value: string): boolean {
  return value.trim() !== '' && Number(value) > 0;
}

export function isNonNegativeNumber(value: string): boolean {
  return value.trim() !== '' && Number(value) >= 0;
}

export function isNotBefore(laterDate: string, earlierDate: string): boolean {
  if (!laterDate || !earlierDate) return true;
  return laterDate >= earlierDate;
}
