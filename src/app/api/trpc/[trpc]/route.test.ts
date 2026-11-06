import { describe, it, expect } from 'vitest';
import { GET } from './route';

// Through the real route handler: errorFormatter only shapes HTTP responses, not createCaller errors.
async function query(path: string, input: unknown) {
  const url = `http://localhost/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await GET(new Request(url));
  return { status: res.status, body: await res.json() };
}

describe('tRPC error shape', () => {
  it('returns flattened zod field errors for invalid input', async () => {
    const { status, body } = await query('stats.getRoundStats', { userId: 'u', lastNRounds: 0 });
    expect(status).toBe(400);
    const { zodError } = body.error.json.data;
    expect(Object.keys(zodError).sort()).toEqual(['fieldErrors', 'formErrors']);
    expect(zodError.formErrors).toEqual([]);
    expect(zodError.fieldErrors.lastNRounds).toEqual([expect.any(String)]);
  });

  it('has no zodError for non-validation errors', async () => {
    const { body } = await query('stats.noSuchProcedure', {});
    expect(body.error.json.data.zodError).toBeNull();
  });
});
