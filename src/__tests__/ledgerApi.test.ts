import { api, ApiError } from '../api/client';
import { getLedgerTransaction, ledgerChangeCount, reverseLedgerTransaction } from '../api/ledger';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../api/client', () => {
  const actual = jest.requireActual('../api/client');
  return { ...actual, api: { ...actual.api, get: jest.fn(), post: jest.fn() } };
});

const post = api.post as jest.Mock;
const get = api.get as jest.Mock;

beforeEach(() => {
  post.mockReset();
  get.mockReset();
});

describe('reverseLedgerTransaction', () => {
  it('reverses a manual entry through the one ledger reversal route, with the reason trimmed', async () => {
    const result = { original: { id: 'manual-1', reversed: true }, reversal: { id: 'contra-1', reversalOfId: 'manual-1' } };
    post.mockResolvedValue(result);
    const before = ledgerChangeCount();

    await expect(reverseLedgerTransaction('school-1', 'manual-1', '  Entered twice  ')).resolves.toBe(result);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/api/v1/finance/transactions/manual-1/reverse',
      { reason: 'Entered twice' },
      'school-1'
    );
    expect(ledgerChangeCount()).toBe(before + 1);
  });

  it('counts an ALREADY_REVERSED 409 as a ledger change, whatever data the server sends with it', async () => {
    // The shared reversal (finance fix 3's) sends the receipt and how it was reversed.
    post.mockRejectedValue(
      new ApiError('This entry was already reversed.', 409, 'ALREADY_REVERSED', {
        receiptNumber: 'GUR/2026-27/RCPT/000012',
        reversedAt: '2026-10-11T06:10:00Z',
        reversalType: 'CORRECTION',
        reversalTransactionId: 'contra-1',
      })
    );
    const before = ledgerChangeCount();

    await expect(reverseLedgerTransaction('school-1', 'fee-tx-1', 'Entered twice')).rejects.toMatchObject({
      status: 409,
      errorCode: 'ALREADY_REVERSED',
    });
    expect(ledgerChangeCount()).toBe(before + 1);
  });

  it('passes on a refusal to reverse a compensating entry, with nothing changed', async () => {
    post.mockRejectedValue(
      new ApiError('A reversal entry cannot itself be reversed.', 400, 'REVERSAL_ENTRY', { reversalOfId: 'manual-1' })
    );
    const before = ledgerChangeCount();

    await expect(reverseLedgerTransaction('school-1', 'contra-1', 'Undo the undo')).rejects.toMatchObject({
      status: 400,
      errorCode: 'REVERSAL_ENTRY',
    });
    expect(ledgerChangeCount()).toBe(before);
  });

  it('encodes the id in the path', async () => {
    post.mockResolvedValue({});
    await reverseLedgerTransaction('school-1', 'a/b c', 'Wrong amount');
    expect(post.mock.calls[0][0]).toBe('/api/v1/finance/transactions/a%2Fb%20c/reverse');
  });
});

describe('getLedgerTransaction', () => {
  it('fetches one entry by id, encoded, in the school', async () => {
    get.mockResolvedValue({ id: 'fee-contra-1' });
    await expect(getLedgerTransaction('school-1', 'fee-contra-1')).resolves.toEqual({ id: 'fee-contra-1' });
    expect(get).toHaveBeenCalledWith('/api/v1/finance/transactions/fee-contra-1', 'school-1');
  });
});
