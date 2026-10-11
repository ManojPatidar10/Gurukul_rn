import type { Vendor } from '../api/expenseTypes';
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import {
  bankDetailsChangedRecently,
  gstinMatchesPan,
  isValidGstin,
  isValidIfsc,
  isValidPan,
  vendorFormErrors,
  vendorFormFrom,
  vendorRequestFrom,
  type VendorForm,
} from '../utils/vendors';

type Tree = { [key: string]: string | Tree };
const at = (tree: Tree, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Tree)?.[part], tree);

const form = (fields: Partial<VendorForm>): VendorForm => ({ ...vendorFormFrom(null), name: 'ABC Supplies', ...fields });

const vendor: Vendor = {
  id: 'v1',
  schoolId: 's1',
  name: 'ABC Supplies',
  contactPhone: '12345',
  contactEmail: null,
  bankAccount: '123456789012',
  upiId: null,
  address: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ifsc: 'SBIN0001234',
  accountHolderName: 'ABC Supplies',
  gstin: null,
  pan: null,
  bankDetailsChangedAt: null,
  bankDetailsChangedBy: null,
  bankDetailsChangedByName: null,
};

describe('tax and bank ids', () => {
  it('checks GSTIN', () => {
    expect(isValidGstin('08ABCDE1234F1Z5')).toBe(true);
    expect(isValidGstin(' 08abcde1234f1z5 ')).toBe(true);
    expect(isValidGstin('08ABCDE1234F0Z5')).toBe(false); // entity number can't be 0
    expect(isValidGstin('08ABCDE1234F1X5')).toBe(false); // 14th character must be Z
    expect(isValidGstin('8ABCDE1234F1Z5')).toBe(false);
    expect(isValidGstin('')).toBe(false);
  });

  it('checks PAN', () => {
    expect(isValidPan('ABCDE1234F')).toBe(true);
    expect(isValidPan('abcde1234f')).toBe(true);
    expect(isValidPan('ABCD1234F')).toBe(false);
    expect(isValidPan('ABCDE12345')).toBe(false);
  });

  it('checks IFSC', () => {
    expect(isValidIfsc('SBIN0001234')).toBe(true);
    expect(isValidIfsc('sbin0001234')).toBe(true);
    expect(isValidIfsc('SBIN1001234')).toBe(false); // 5th character must be 0
    expect(isValidIfsc('SBIN000123')).toBe(false);
  });

  it('matches the PAN inside a GSTIN', () => {
    expect(gstinMatchesPan('08ABCDE1234F1Z5', 'ABCDE1234F')).toBe(true);
    expect(gstinMatchesPan('08abcde1234f1z5', ' abcde1234f ')).toBe(true);
    expect(gstinMatchesPan('08ABCDE1234F1Z5', 'ZZZZZ9999Z')).toBe(false);
    expect(gstinMatchesPan('', 'ABCDE1234F')).toBe(true);
    expect(gstinMatchesPan('08ABCDE1234F1Z5', null)).toBe(true);
  });
});

describe('vendorFormErrors', () => {
  it('passes a good form, and an empty optional field', () => {
    expect(vendorFormErrors(form({}))).toEqual({});
    expect(
      vendorFormErrors(
        form({
          contactPhone: '9876543210',
          contactEmail: 'shop@example.com',
          bankAccount: '123456789',
          ifsc: 'sbin0001234',
          accountHolderName: 'ABC',
          upiId: 'abc@okbank',
          gstin: '08ABCDE1234F1Z5',
          pan: 'ABCDE1234F',
          address: 'Main road',
        })
      )
    ).toEqual({});
  });

  it('names every bad field', () => {
    expect(
      vendorFormErrors(
        form({
          name: ' ',
          contactPhone: '12345',
          contactEmail: 'nope',
          bankAccount: '12ab',
          ifsc: 'SBIN1',
          upiId: 'no-at-sign',
          gstin: 'GST',
          pan: 'PAN',
          address: 'x'.repeat(501),
          accountHolderName: 'y'.repeat(256),
        })
      )
    ).toEqual({
      name: 'vendors.form.errors.name',
      contactPhone: 'vendors.form.errors.contactPhone',
      contactEmail: 'vendors.form.errors.contactEmail',
      bankAccount: 'vendors.form.errors.bankAccount',
      ifsc: 'vendors.form.errors.ifsc',
      upiId: 'vendors.form.errors.upiId',
      gstin: 'vendors.form.errors.gstin',
      pan: 'vendors.form.errors.pan',
      address: 'vendors.form.errors.address',
      accountHolderName: 'vendors.form.errors.accountHolderName',
    });
    expect(vendorFormErrors(form({ name: 'n'.repeat(256) }))).toEqual({ name: 'vendors.form.errors.nameTooLong' });
  });

  it('refuses a GSTIN whose PAN differs from the PAN entered', () => {
    expect(vendorFormErrors(form({ gstin: '08ABCDE1234F1Z5', pan: 'ZZZZZ9999Z' }))).toEqual({
      gstin: 'vendors.form.errors.gstinPanMismatch',
    });
  });

  it('on an edit, checks only the fields that changed', () => {
    const original = vendorFormFrom(vendor);
    // The saved phone is in an old format; changing the name doesn't trip over it.
    expect(vendorFormErrors({ ...original, name: 'ABC Traders' }, original)).toEqual({});
    expect(vendorFormErrors({ ...original, contactPhone: '123' }, original)).toEqual({
      contactPhone: 'vendors.form.errors.contactPhone',
    });
    // Only a change of case: the same IFSC once normalised.
    expect(vendorFormErrors({ ...original, ifsc: 'sbin0001234' }, original)).toEqual({});
    // Clearing a field is always fine.
    expect(vendorFormErrors({ ...original, contactPhone: '' }, original)).toEqual({});
  });

  it('has words for every error in both languages', () => {
    const keys = Object.values(
      vendorFormErrors(
        form({ name: '', contactPhone: '1', contactEmail: 'x', bankAccount: '1', ifsc: '1', upiId: 'x', gstin: '1', pan: '1' })
      )
    );
    keys.push('vendors.form.errors.gstinPanMismatch', 'vendors.form.errors.nameTooLong', 'vendors.form.errors.address');
    for (const key of keys) {
      expect(at(en as Tree, key)).toEqual(expect.any(String));
      expect(at(hi as Tree, key)).toEqual(expect.any(String));
    }
  });
});

describe('vendorRequestFrom', () => {
  it('leaves empty fields out of a new vendor, and upper-cases the ids', () => {
    expect(vendorRequestFrom(form({ name: ' ABC ', ifsc: ' sbin0001234 ', gstin: '08abcde1234f1z5', pan: 'abcde1234f' }), false)).toEqual({
      name: 'ABC',
      ifsc: 'SBIN0001234',
      gstin: '08ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
    });
  });

  it("sends '' for an empty field on an edit, which clears it", () => {
    const request = vendorRequestFrom({ ...vendorFormFrom(vendor), ifsc: '' }, true);
    expect(request.ifsc).toBe('');
    expect(request.bankAccount).toBe('123456789012');
    expect(request.contactEmail).toBe('');
    expect(Object.keys(request).sort()).toEqual(
      ['name', 'contactPhone', 'contactEmail', 'bankAccount', 'ifsc', 'accountHolderName', 'upiId', 'address', 'gstin', 'pan'].sort()
    );
  });
});

describe('bankDetailsChangedRecently', () => {
  const now = new Date('2026-10-11T12:00:00Z');
  const DAY = 24 * 60 * 60 * 1000;

  it('is true within 30 days, including exactly 30', () => {
    expect(bankDetailsChangedRecently(new Date(now.getTime() - DAY).toISOString(), now)).toBe(true);
    expect(bankDetailsChangedRecently(new Date(now.getTime() - 30 * DAY).toISOString(), now)).toBe(true);
    expect(bankDetailsChangedRecently(new Date(now.getTime() - 30 * DAY - 1000).toISOString(), now)).toBe(false);
  });

  it('counts a time just ahead of the phone clock as recent', () => {
    expect(bankDetailsChangedRecently(new Date(now.getTime() + 60_000).toISOString(), now)).toBe(true);
  });

  it('is false with no change, or a value that is not a date', () => {
    expect(bankDetailsChangedRecently(null, now)).toBe(false);
    expect(bankDetailsChangedRecently(undefined, now)).toBe(false);
    expect(bankDetailsChangedRecently('not a date', now)).toBe(false);
  });

  it('takes another window', () => {
    expect(bankDetailsChangedRecently(new Date(now.getTime() - 8 * DAY).toISOString(), now, 7)).toBe(false);
  });
});
