import { describe, expect, it } from 'vitest';
const smoke = process.env.E2E === '1' ? describe : describe.skip;

smoke('api gateway smoke checks', () => {
  it('returns gateway health', async () => {
    const health = await fetch('http://localhost:8080/health');
    expect(health.ok).toBe(true);

    const healthPayload = (await health.json()) as {
      service: string;
      dependencies: Record<string, string>;
    };
    expect(healthPayload.service).toBe('api-gateway');
    expect(healthPayload.dependencies).toEqual({});
  });
});
