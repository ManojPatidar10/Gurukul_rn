import { parseUpiResponse } from '../utils/upiResponseParser';

describe('parseUpiResponse', () => {
  it('parses a successful response', () => {
    const result = parseUpiResponse('Status=SUCCESS&txnId=12345&responseCode=00&txnRef=FEE123');
    expect(result.status).toBe('RESPONSE_SUCCESS');
    expect(result.transactionId).toBe('12345');
    expect(result.responseCode).toBe('00');
    expect(result.transactionRef).toBe('FEE123');
  });

  it('is case-insensitive for both keys and values', () => {
    const result = parseUpiResponse('status=success&txnid=999');
    expect(result.status).toBe('RESPONSE_SUCCESS');
    expect(result.transactionId).toBe('999');
  });

  it('treats SUBMITTED as PENDING', () => {
    const result = parseUpiResponse('Status=SUBMITTED&txnRef=FEE123');
    expect(result.status).toBe('PENDING');
    expect(result.transactionRef).toBe('FEE123');
  });

  it('treats PENDING as PENDING', () => {
    const result = parseUpiResponse('Status=PENDING');
    expect(result.status).toBe('PENDING');
  });

  it('treats FAILURE as FAILED', () => {
    const result = parseUpiResponse('Status=FAILURE');
    expect(result.status).toBe('FAILED');
  });

  it('treats FAILED as FAILED', () => {
    const result = parseUpiResponse('Status=FAILED');
    expect(result.status).toBe('FAILED');
  });

  it('treats unrecognized/malformed text as UNKNOWN without throwing', () => {
    const result = parseUpiResponse('randomtext');
    expect(result.status).toBe('UNKNOWN');
  });

  it('treats an empty response as UNKNOWN without throwing', () => {
    const result = parseUpiResponse('');
    expect(result.status).toBe('UNKNOWN');
  });

  it('treats a null/undefined response as UNKNOWN without throwing', () => {
    expect(parseUpiResponse(null).status).toBe('UNKNOWN');
    expect(parseUpiResponse(undefined).status).toBe('UNKNOWN');
  });

  it('URL-decodes values without crashing', () => {
    const result = parseUpiResponse('Status=SUCCESS&txnRef=FEE%20123%26extra');
    expect(result.status).toBe('RESPONSE_SUCCESS');
    expect(result.transactionRef).toBe('FEE 123&extra');
  });

  it('does not crash on a malformed percent-encoding sequence', () => {
    const result = parseUpiResponse('Status=SUCCESS&txnRef=%E0%A4%');
    expect(result.status).toBe('RESPONSE_SUCCESS');
    expect(result.transactionRef).toBe('%E0%A4%');
  });

  it('preserves the raw response string for audit/debugging', () => {
    const raw = 'Status=SUCCESS&txnId=12345';
    expect(parseUpiResponse(raw).rawResponse).toBe(raw);
  });
});
