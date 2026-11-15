import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  EconomicEstimateIdConflictError,
  type EconomicEstimateRecordRepository,
} from '../../src/application/ports/economic-estimate-record-repository';
import {
  createOperationalEconomicsHttpServer,
  type OperationalEconomicsReadinessProbe,
} from '../../src/infrastructure/http/operational-economics-http-server';
import type {
  EconomicEstimateRecord,
  EconomicEstimateRecordInput,
} from '../../src/domain/economic-estimate-record';

const recordInput: EconomicEstimateRecordInput = {
  contractVersion: '1.0.0',
  estimateId: '0197e9e9-2dc0-7000-8000-000000000011',
  scope: {
    type: 'candidate',
    loadId: '0197e9e9-2dc0-7000-8000-000000000012',
    loadRevision: '17',
    trioId: '0197e9e9-2dc0-7000-8000-000000000013',
    trioRevision: '6',
  },
  modelVersion: 'model-pending',
  inputSchemaVersion: 'inputs-pending',
  resultSchemaVersion: 'result-pending',
  inputs: { source: 'not-yet-defined' },
  result: { status: 'not-yet-defined' },
  provenance: [],
  generatedAt: '2026-01-15T12:00:00.000Z',
};

describe('Operational Economics HTTP API', () => {
  const records = new Map<string, EconomicEstimateRecord>();
  let server: ReturnType<typeof createOperationalEconomicsHttpServer>;
  let baseUrl: string;

  const repository: EconomicEstimateRecordRepository = {
    async create(record) {
      const existing = records.get(record.estimateId);
      if (existing) {
        const { recordedAt: _recordedAt, ...existingInput } = existing;
        if (JSON.stringify(existingInput) !== JSON.stringify(record)) {
          throw new EconomicEstimateIdConflictError();
        }
        return { record: existing, created: false };
      }
      const saved = { ...record, recordedAt: '2026-01-15T12:01:00.000Z' };
      records.set(saved.estimateId, saved);
      return { record: saved, created: true };
    },
    async findById(estimateId) {
      return records.get(estimateId) ?? null;
    },
    async findByLoad(loadId, trioId, limit, cursor) {
      const matching = [...records.values()]
        .filter(
          (record) =>
            record.scope.loadId === loadId &&
            (trioId === undefined ||
              (record.scope.type === 'candidate' && record.scope.trioId === trioId)) &&
            (!cursor ||
              record.recordedAt < cursor.recordedAt ||
              (record.recordedAt === cursor.recordedAt && record.estimateId < cursor.estimateId))
        )
        .sort(
          (left, right) =>
            right.recordedAt.localeCompare(left.recordedAt) ||
            right.estimateId.localeCompare(left.estimateId)
        );
      return matching.slice(0, limit);
    },
  };

  const readinessProbe: OperationalEconomicsReadinessProbe = async () => true;

  beforeEach(async () => {
    records.clear();
    server = createOperationalEconomicsHttpServer(
      repository,
      { startupComplete: true },
      readinessProbe
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('The Operational Economics test server did not bind a TCP port.');
    }
    const tcpAddress: AddressInfo = address;
    baseUrl = `http://127.0.0.1:${tcpAddress.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  });

  it('persists and retrieves versioned estimate records, including idempotent retries', async () => {
    const createResponse = await fetch(`${baseUrl}/internal/v1/estimate-records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(recordInput),
    });
    expect(createResponse.status).toBe(201);
    expect((await createResponse.json()).estimateId).toBe(recordInput.estimateId);

    const replayResponse = await fetch(`${baseUrl}/internal/v1/estimate-records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(recordInput),
    });
    expect(replayResponse.status).toBe(200);

    const readResponse = await fetch(
      `${baseUrl}/internal/v1/estimate-records/${recordInput.estimateId}`
    );
    expect(readResponse.status).toBe(200);
    expect((await readResponse.json()).scope.trioId).toBe(recordInput.scope.trioId);

    const secondRecord = {
      ...recordInput,
      estimateId: '0197e9e9-2dc0-7000-8000-000000000014',
      result: { status: 'second-record' },
    };
    const secondCreateResponse = await fetch(`${baseUrl}/internal/v1/estimate-records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(secondRecord),
    });
    expect(secondCreateResponse.status).toBe(201);

    const listResponse = await fetch(
      `${baseUrl}/internal/v1/estimate-records?loadId=${recordInput.scope.loadId}&trioId=${recordInput.scope.trioId}`
    );
    expect(listResponse.status).toBe(200);
    expect((await listResponse.json()).estimates).toHaveLength(2);

    const firstPageResponse = await fetch(
      `${baseUrl}/internal/v1/estimate-records?loadId=${recordInput.scope.loadId}&trioId=${recordInput.scope.trioId}&limit=1`
    );
    const firstPage = await firstPageResponse.json();
    expect(firstPage.estimates).toHaveLength(1);
    expect(firstPage.hasMore).toBe(true);
    expect(typeof firstPage.nextCursor).toBe('string');
    const secondPageResponse = await fetch(
      `${baseUrl}/internal/v1/estimate-records?loadId=${recordInput.scope.loadId}&trioId=${recordInput.scope.trioId}&limit=1&cursor=${encodeURIComponent(firstPage.nextCursor)}`
    );
    const secondPage = await secondPageResponse.json();
    expect(secondPage.estimates).toHaveLength(1);
    expect(secondPage.hasMore).toBe(false);
  });

  it('returns explicit validation and ID-conflict errors', async () => {
    const invalidResponse = await fetch(`${baseUrl}/internal/v1/estimate-records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estimateId: 'invalid' }),
    });
    expect(invalidResponse.status).toBe(400);
    expect((await invalidResponse.json()).error.code).toBe('invalid_estimate_record');

    records.set(recordInput.estimateId, {
      ...recordInput,
      result: { status: 'different' },
      recordedAt: '2026-01-15T12:01:00.000Z',
    });
    const conflictResponse = await fetch(`${baseUrl}/internal/v1/estimate-records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(recordInput),
    });
    expect(conflictResponse.status).toBe(409);
    expect((await conflictResponse.json()).error.code).toBe('estimate_id_conflict');
  });
});
