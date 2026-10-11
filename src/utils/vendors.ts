import type { Vendor, VendorRequest } from '../api/expenseTypes';
import { isValidBankAccount, isValidEmail, isValidIfsc, isValidPhone, isValidUpiId } from './validators';

/**
 * The vendor form's checks, matching the server's (specs/expenses-and-vendors section 4), and the
 * request it sends. Pure, so it's unit-tested in src/__tests__/vendors.test.ts.
 */

export { isValidIfsc };

/** 15 characters: state code, the PAN, entity number, Z, check character - e.g. 08ABCDE1234F1Z5. */
export function isValidGstin(value: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value.trim().toUpperCase());
}

/** 10 characters, e.g. ABCDE1234F. */
export function isValidPan(value: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value.trim().toUpperCase());
}

/** A GSTIN carries the business's PAN in characters 3-12. True when either is blank. */
export function gstinMatchesPan(gstin: string | null | undefined, pan: string | null | undefined): boolean {
  const g = (gstin ?? '').trim().toUpperCase();
  const p = (pan ?? '').trim().toUpperCase();
  if (!g || !p) return true;
  return g.substring(2, 12) === p;
}

export type VendorFormField =
  | 'name'
  | 'contactPhone'
  | 'contactEmail'
  | 'bankAccount'
  | 'ifsc'
  | 'accountHolderName'
  | 'upiId'
  | 'address'
  | 'gstin'
  | 'pan';

/** The form as typed: '' for an empty field. */
export type VendorForm = Record<VendorFormField, string>;

const FIELDS: readonly VendorFormField[] = [
  'name',
  'contactPhone',
  'contactEmail',
  'bankAccount',
  'ifsc',
  'accountHolderName',
  'upiId',
  'address',
  'gstin',
  'pan',
];

const UPPER_CASED: ReadonlySet<VendorFormField> = new Set<VendorFormField>(['ifsc', 'gstin', 'pan']);

export const VENDOR_MAX_LENGTHS: Readonly<Partial<Record<VendorFormField, number>>> = {
  name: 255,
  contactEmail: 255,
  accountHolderName: 255,
  upiId: 100,
  address: 500,
  ifsc: 11,
  gstin: 15,
  pan: 10,
};

/** A field's value as the server stores it: trimmed, and IFSC, GSTIN and PAN upper-cased. */
export function normalizeVendorField(field: VendorFormField, value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return UPPER_CASED.has(field) ? trimmed.toUpperCase() : trimmed;
}

/** The form for a vendor being edited, or an empty one for a new vendor. */
export function vendorFormFrom(vendor?: Vendor | null): VendorForm {
  const form = {} as VendorForm;
  for (const field of FIELDS) form[field] = (vendor?.[field] as string | null | undefined) ?? '';
  return form;
}

const ERRORS = 'vendors.form.errors';

/**
 * What's wrong with the form, as i18n keys by field; empty when it's fine. Like the server, a field
 * is only checked when it's filled in on a new vendor, or changed on an edit (`original`) - an old
 * value in another format doesn't block an unrelated change.
 */
export function vendorFormErrors(form: VendorForm, original?: VendorForm | null): Partial<Record<VendorFormField, string>> {
  const errors: Partial<Record<VendorFormField, string>> = {};
  const value = (field: VendorFormField) => normalizeVendorField(field, form[field]);
  const checked = (field: VendorFormField) =>
    value(field) !== '' && (!original || value(field) !== normalizeVendorField(field, original[field]));
  const tooLong = (field: VendorFormField) => value(field).length > (VENDOR_MAX_LENGTHS[field] ?? Infinity);

  if (value('name') === '') errors.name = `${ERRORS}.name`;
  else if (tooLong('name')) errors.name = `${ERRORS}.nameTooLong`;

  if (checked('contactPhone') && !isValidPhone(value('contactPhone'))) errors.contactPhone = `${ERRORS}.contactPhone`;
  if (checked('contactEmail') && (!isValidEmail(value('contactEmail')) || tooLong('contactEmail'))) {
    errors.contactEmail = `${ERRORS}.contactEmail`;
  }
  if (checked('bankAccount') && !isValidBankAccount(value('bankAccount'))) errors.bankAccount = `${ERRORS}.bankAccount`;
  if (checked('ifsc') && !isValidIfsc(value('ifsc'))) errors.ifsc = `${ERRORS}.ifsc`;
  if (checked('accountHolderName') && tooLong('accountHolderName')) errors.accountHolderName = `${ERRORS}.accountHolderName`;
  if (checked('upiId') && (!isValidUpiId(value('upiId')) || tooLong('upiId'))) errors.upiId = `${ERRORS}.upiId`;
  if (checked('address') && tooLong('address')) errors.address = `${ERRORS}.address`;
  if (checked('gstin') && !isValidGstin(value('gstin'))) errors.gstin = `${ERRORS}.gstin`;
  if (checked('pan') && !isValidPan(value('pan'))) errors.pan = `${ERRORS}.pan`;

  // Both set and well-formed, and one of them new: the PAN inside the GSTIN must be the PAN entered.
  if (
    !errors.gstin &&
    !errors.pan &&
    (checked('gstin') || checked('pan')) &&
    value('gstin') !== '' &&
    value('pan') !== '' &&
    !gstinMatchesPan(value('gstin'), value('pan'))
  ) {
    errors.gstin = `${ERRORS}.gstinPanMismatch`;
  }
  return errors;
}

/**
 * The body to send. Values are trimmed, and IFSC, GSTIN and PAN upper-cased. A new vendor leaves
 * empty fields out; an edit sends '' for them, which clears whatever was saved.
 */
export function vendorRequestFrom(form: VendorForm, isEdit: boolean): VendorRequest {
  const request: VendorRequest = { name: normalizeVendorField('name', form.name) };
  for (const field of FIELDS) {
    if (field === 'name') continue;
    const value = normalizeVendorField(field, form[field]);
    if (value !== '' || isEdit) request[field] = value;
  }
  return request;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True when the vendor's bank details were changed within the last `days` days - worth a second
 * look before paying. A time slightly ahead of the phone's clock counts as recent.
 */
export function bankDetailsChangedRecently(changedAt: string | null | undefined, now: Date = new Date(), days = 30): boolean {
  if (!changedAt) return false;
  const changed = new Date(changedAt).getTime();
  if (Number.isNaN(changed)) return false;
  return now.getTime() - changed <= days * DAY_MS;
}
