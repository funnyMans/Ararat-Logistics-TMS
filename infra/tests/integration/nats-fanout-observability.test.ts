import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { connect, StringCodec } from 'nats';
import { describe, expect, it } from 'vitest';

const natsIntegration = process.env.NATS_INTEGRATION === '1' ? describe : describe.skip;
const composeArgs = ['compose', '-f', 'infra/docker-compose.dev.yml'];
const observationTimeoutMs = 45_000;
const codec = StringCodec();

type OtlpAttribute = {
  key: string;
  value: { stringValue: string };
};

type OtlpSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
  status: { code: number };
};

function runCompose(...args: string[]): string {
  return execFileSync('docker', [...composeArgs, ...args], {
    encoding: 'utf8',
    timeout: 10_000,
  }).trim();
}

function getHostPort(service: string, containerPort: number): number {
  const binding = runCompose('port', service, String(containerPort));
  const hostPort = Number(binding.split(':').at(-1));
  if (!Number.isInteger(hostPort) || hostPort < 1) {
    throw new Error(`Could not determine ${service}'s published port from "${binding}".`);
  }

  return hostPort;
}

function queryPostgres(sql: string): string {
  return execFileSync(
    'docker',
    [
      ...composeArgs,
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      'exec psql --no-psqlrc --quiet --set ON_ERROR_STOP=1 --tuples-only --no-align --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --command "$1"',
      'nats-conformance',
      sql,
    ],
    {
      encoding: 'utf8',
      timeout: 10_000,
    }
  ).trim();
}

async function waitFor(
  description: string,
  check: () => Promise<boolean>,
  timeoutMs = observationTimeoutMs
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }

  throw new Error(`${description} was not observed before timeout.`, { cause: lastError });
}

async function waitForValue<T>(
  description: string,
  read: () => Promise<T | null>,
  timeoutMs = observationTimeoutMs
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const value = await read();
      if (value !== null) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }

  throw new Error(`${description} was not observed before timeout.`, { cause: lastError });
}

async function natsConnection(clientPort: number) {
  return connect({
    servers: `127.0.0.1:${clientPort}`,
    timeout: 1_000,
    maxReconnectAttempts: 0,
  });
}

async function waitForNatsHealth(monitorPort: number): Promise<void> {
  await waitFor('NATS health endpoint', async () => {
    const response = await fetch(`http://127.0.0.1:${monitorPort}/healthz`, {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  });
}

async function receiveMessage(
  subscription: ReturnType<Awaited<ReturnType<typeof natsConnection>>['subscribe']>,
  timeoutMs = 5_000
): Promise<string> {
  const iterator = subscription[Symbol.asyncIterator]();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const message = await Promise.race([
      iterator.next(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Timed out waiting for NATS fan-out.')),
          timeoutMs
        );
      }),
    ]);

    if (message.done) throw new Error('NATS subscription closed before receiving a message.');
    return codec.decode(message.value.data);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function createSpan(params: {
  traceId: string;
  parentSpanId?: string;
  name: string;
  correlationId: string;
  attributes?: Record<string, string>;
}): OtlpSpan {
  const now = (BigInt(Date.now()) * 1_000_000n).toString();
  return {
    traceId: params.traceId,
    spanId: randomBytes(8).toString('hex'),
    ...(params.parentSpanId ? { parentSpanId: params.parentSpanId } : {}),
    name: params.name,
    kind: 1,
    startTimeUnixNano: now,
    endTimeUnixNano: now,
    attributes: [
      { key: 'correlation.id', value: { stringValue: params.correlationId } },
      ...Object.entries(params.attributes ?? {}).map(([key, value]) => ({
        key,
        value: { stringValue: value },
      })),
    ],
    status: { code: 1 },
  };
}

function finishSpan(span: OtlpSpan): void {
  span.endTimeUnixNano = (BigInt(Date.now()) * 1_000_000n).toString();
}

function traceparent(traceId: string, spanId: string): string {
  return `00-${traceId}-${spanId}-01`;
}

function exportTestSpans(traceId: string, spans: OtlpSpan[]): void {
  const payload = JSON.stringify({
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'foundation-conformance-test' } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: 'foundation-conformance-test', version: '1' },
            spans,
          },
        ],
      },
    ],
  });
  const script = [
    'let body = "";',
    'process.stdin.setEncoding("utf8");',
    'process.stdin.on("data", chunk => body += chunk);',
    'process.stdin.on("end", async () => {',
    '  const response = await fetch("http://otel-collector:4318/v1/traces", {',
    '    method: "POST",',
    '    headers: { "content-type": "application/json" },',
    '    body,',
    '  });',
    '  if (!response.ok) {',
    '    console.error(await response.text());',
    '    process.exitCode = 1;',
    '    return;',
    '  }',
    '  console.log("exported test spans");',
    '});',
  ].join(' ');
  const output = execFileSync(
    'docker',
    [...composeArgs, 'exec', '-T', 'api-gateway', 'node', '-e', script],
    {
      encoding: 'utf8',
      input: payload,
      timeout: 10_000,
    }
  );
  if (!output.includes('exported test spans')) {
    throw new Error(`OpenTelemetry Collector did not acknowledge test spans for ${traceId}.`);
  }
}

async function readPrometheusMetric(query: string): Promise<{
  value: number;
  labels: Record<string, string>;
} | null> {
  const url = `http://127.0.0.1:${getHostPort('prometheus', 9090)}/api/v1/query`;
  const response = await fetch(`${url}?${new URLSearchParams({ query })}`, {
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error(`Prometheus query failed with HTTP ${response.status}.`);
  const result = (await response.json()) as {
    data?: { result?: Array<{ metric: Record<string, string>; value: [number, string] }> };
  };
  const sample = result.data?.result?.[0];
  if (!sample) return null;

  return { labels: sample.metric, value: Number(sample.value[1]) };
}

function expectStaticMetricLabels(labels: Record<string, string>): void {
  expect(labels).toMatchObject({
    job: 'api-gateway',
    instance: 'api-gateway:3000',
    method: 'POST',
    route: 'unmatched',
    status_code: '404',
  });
  expect(Object.keys(labels).sort()).toEqual([
    '__name__',
    'instance',
    'job',
    'method',
    'route',
    'status_code',
  ]);
}

async function assertTraceInTempo(
  traceId: string,
  correlationId: string,
  requiredSpanNames: string[],
  gatewayParentSpanIds: string[]
): Promise<void> {
  let traceBody = '';
  await waitFor('conformance trace in Tempo', async () => {
    traceBody = runCompose(
      'exec',
      '-T',
      'grafana',
      'sh',
      '-c',
      'wget -qO- "$1" 2>/dev/null || true',
      'trace-query',
      `http://tempo:3200/api/traces/${traceId}`
    );
    if (!traceBody) return false;
    const trace = JSON.parse(traceBody) as { batches?: unknown[]; resourceSpans?: unknown[] };
    const serialized = JSON.stringify(trace);
    return (
      Boolean(trace.batches?.length || trace.resourceSpans?.length) &&
      serialized.includes(correlationId) &&
      requiredSpanNames.every((name) => serialized.includes(name))
    );
  });

  const parsed = JSON.parse(traceBody) as {
    batches?: Array<{
      scopeSpans?: Array<{
        spans?: Array<{
          traceId?: string;
          spanId?: string;
          parentSpanId?: string;
          name?: string;
        }>;
      }>;
    }>;
    resourceSpans?: Array<{
      scopeSpans?: Array<{
        spans?: Array<{
          traceId?: string;
          spanId?: string;
          parentSpanId?: string;
          name?: string;
        }>;
      }>;
    }>;
  };
  const resourceSpans =
    parsed.resourceSpans?.flatMap(
      (resource) => resource.scopeSpans?.flatMap((scope) => scope.spans ?? []) ?? []
    ) ?? [];
  const spans = [
    ...(parsed.batches?.flatMap(
      (batch) => batch.scopeSpans?.flatMap((scope) => scope.spans ?? []) ?? []
    ) ?? []),
    ...resourceSpans,
  ];
  expect(spans.map((span) => span.name)).toEqual(expect.arrayContaining(requiredSpanNames));
  expect(
    spans.every((span) => Buffer.from(span.traceId ?? '', 'base64').toString('hex') === traceId)
  ).toBe(true);

  const rootSpan = spans.find((span) => span.name === 'f4.conformance.transaction');
  if (!rootSpan?.spanId) throw new Error('Tempo trace did not include its conformance root span.');
  const toHex = (base64: string | undefined) => Buffer.from(base64 ?? '', 'base64').toString('hex');
  const gatewayRequests = spans.filter((span) => span.name === 'http.server.request');
  const observedGatewayParents = gatewayRequests.map((span) => toHex(span.parentSpanId));
  expect(gatewayRequests).toHaveLength(gatewayParentSpanIds.length);
  expect(observedGatewayParents).toEqual(expect.arrayContaining(gatewayParentSpanIds));
  expect(gatewayParentSpanIds).not.toContain(toHex(rootSpan.spanId));
  expect(JSON.stringify(parsed)).toContain(correlationId);
}

natsIntegration('NATS secondary fan-out conformance', () => {
  it('manually replays lost fan-out from durable facts with one correlated conformance trace', async () => {
    const eventId = randomUUID();
    const correlationId = randomUUID();
    const traceId = randomBytes(16).toString('hex');
    const spans: OtlpSpan[] = [];
    const rootSpan = createSpan({
      traceId,
      name: 'f4.conformance.transaction',
      correlationId,
      attributes: { 'conformance.milestone': 'F4' },
    });
    spans.push(rootSpan);
    const subject = `foundation.conformance.fanout.${eventId.replaceAll('-', '')}`;
    const natsClientPort = getHostPort('nats', 4222);
    const natsMonitorPort = getHostPort('nats', 8222);
    const eventIdSql = `'${eventId}'`;
    const gatewayPort = getHostPort('api-gateway', 3000);
    const gatewayParentSpanIds: string[] = [];
    let factInserted = false;
    let natsRecoveryNeeded = false;
    let connection: Awaited<ReturnType<typeof natsConnection>> | undefined;
    let traceExported = false;
    let testFailure: unknown;
    let hasTestFailure = false;

    const stage = async <T>(name: string, action: (span: OtlpSpan) => Promise<T>): Promise<T> => {
      const span = createSpan({
        traceId,
        parentSpanId: rootSpan.spanId,
        name,
        correlationId,
      });
      spans.push(span);
      try {
        return await action(span);
      } finally {
        finishSpan(span);
      }
    };

    try {
      await waitFor('NATS health endpoint before outage', async () => {
        const response = await fetch(`http://127.0.0.1:${natsMonitorPort}/healthz`, {
          signal: AbortSignal.timeout(2_000),
        });
        return response.ok;
      });

      await stage('f4.postgres.commit', async () => {
        queryPostgres(`
          CREATE SCHEMA IF NOT EXISTS foundation_conformance;
          CREATE TABLE IF NOT EXISTS foundation_conformance.fanout_facts (
            event_id uuid PRIMARY KEY,
            correlation_id uuid NOT NULL,
            fact_payload jsonb NOT NULL,
            committed_at timestamptz NOT NULL DEFAULT now()
          );
          INSERT INTO foundation_conformance.fanout_facts (event_id, correlation_id, fact_payload)
          VALUES (${eventIdSql}, '${correlationId}', '{"fact":"committed"}'::jsonb);
        `);
        factInserted = true;
        expect(
          queryPostgres(
            `SELECT count(*) FROM foundation_conformance.fanout_facts WHERE event_id = ${eventIdSql}`
          )
        ).toBe('1');
      });

      const requestCounterQuery =
        'api_gateway_http_requests_total{job="api-gateway",instance="api-gateway:3000",method="POST",route="unmatched",status_code="404"}';
      const durationCountQuery =
        'api_gateway_http_request_duration_ms_count{job="api-gateway",instance="api-gateway:3000",method="POST",route="unmatched",status_code="404"}';
      const preWarmupCounter = await readPrometheusMetric(requestCounterQuery);
      const preWarmupDuration = await readPrometheusMetric(durationCountQuery);
      const warmupResponse = await fetch(`http://127.0.0.1:${gatewayPort}/health`, {
        method: 'POST',
        signal: AbortSignal.timeout(5_000),
      });
      expect(warmupResponse.status).toBe(404);
      const metricBaseline = await waitForValue(
        'Prometheus warmup samples before baseline capture',
        async () => {
          const counter = await readPrometheusMetric(requestCounterQuery);
          const duration = await readPrometheusMetric(durationCountQuery);
          return counter !== null &&
            duration !== null &&
            (preWarmupCounter === null || counter.value > preWarmupCounter.value) &&
            (preWarmupDuration === null || duration.value > preWarmupDuration.value)
            ? { counter, duration }
            : null;
        }
      );
      expectStaticMetricLabels(metricBaseline.counter.labels);
      expectStaticMetricLabels(metricBaseline.duration.labels);

      await stage('f4.gateway.health_request', async (span) => {
        gatewayParentSpanIds.push(span.spanId);
        const propagatedTraceparent = traceparent(traceId, span.spanId);
        const response = await fetch(`http://127.0.0.1:${gatewayPort}/health`, {
          headers: {
            'x-correlation-id': correlationId,
            traceparent: propagatedTraceparent,
          },
          signal: AbortSignal.timeout(5_000),
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('x-correlation-id')).toBe(correlationId);
        expect(response.headers.get('x-trace-id')).toBe(traceId);
      });

      await stage('f4.gateway.metric_probe', async (span) => {
        gatewayParentSpanIds.push(span.spanId);
        const propagatedTraceparent = traceparent(traceId, span.spanId);
        const response = await fetch(`http://127.0.0.1:${gatewayPort}/health`, {
          method: 'POST',
          headers: {
            'x-correlation-id': correlationId,
            traceparent: propagatedTraceparent,
          },
          signal: AbortSignal.timeout(5_000),
        });
        expect(response.status).toBe(404);
        expect(response.headers.get('x-correlation-id')).toBe(correlationId);
        expect(response.headers.get('x-trace-id')).toBe(traceId);
        return response;
      });

      await stage('f4.prometheus.assert_increment', async () => {
        await waitFor(
          'exact counter and histogram increments for the correlated request',
          async () => {
            const counterAfter = await readPrometheusMetric(requestCounterQuery);
            const durationAfter = await readPrometheusMetric(durationCountQuery);
            if (!counterAfter || !durationAfter) return false;
            expectStaticMetricLabels(counterAfter.labels);
            expectStaticMetricLabels(durationAfter.labels);
            if (
              counterAfter.value > metricBaseline.counter.value + 1 ||
              durationAfter.value > metricBaseline.duration.value + 1
            ) {
              throw new Error('Unrelated health requests changed the bounded metric series.');
            }
            return (
              counterAfter.value === metricBaseline.counter.value + 1 &&
              durationAfter.value === metricBaseline.duration.value + 1
            );
          }
        );
      });

      await stage('f4.nats.live_publish', async (span) => {
        connection = await natsConnection(natsClientPort);
        const subscription = connection.subscribe(subject);
        await connection.flush();
        const payload = {
          eventId,
          correlationId,
          fact: 'committed',
          traceparent: traceparent(traceId, span.spanId),
        };
        connection.publish(subject, codec.encode(JSON.stringify(payload)));
        await connection.flush();
        expect(JSON.parse(await receiveMessage(subscription))).toEqual(payload);
        await connection.close();
        connection = undefined;
      });

      await stage('f4.nats.outage', async () => {
        natsRecoveryNeeded = true;
        runCompose('stop', 'nats');
        if (process.env.NATS_RECOVERY_TEST_FAILURE === '1') {
          throw new Error('Injected failure after starting NATS outage for cleanup verification.');
        }
        await expect(
          fetch(`http://127.0.0.1:${natsMonitorPort}/healthz`, {
            signal: AbortSignal.timeout(1_000),
          })
        ).rejects.toThrow();
        expect(
          await fetch(`http://127.0.0.1:${gatewayPort}/ready`, {
            signal: AbortSignal.timeout(5_000),
          }).then((response) => response.status)
        ).toBe(200);
        expect(
          queryPostgres(
            `SELECT count(*) FROM foundation_conformance.fanout_facts WHERE event_id = ${eventIdSql}`
          )
        ).toBe('1');
        await expect(natsConnection(natsClientPort)).rejects.toThrow();
      });

      await stage('f4.nats.restart', async () => {
        runCompose('up', '-d', 'nats');
        await waitForNatsHealth(natsMonitorPort);
        natsRecoveryNeeded = false;
      });

      await stage('f4.nats.manual_replay', async (span) => {
        connection = await natsConnection(natsClientPort);
        const subscription = connection.subscribe(subject, { max: 1 });
        await connection.flush();
        const durableFact = JSON.parse(
          queryPostgres(
            `SELECT json_build_object('eventId', event_id, 'correlationId', correlation_id, 'fact', fact_payload->>'fact') FROM foundation_conformance.fanout_facts WHERE event_id = ${eventIdSql}`
          )
        ) as { eventId: string; correlationId: string; fact: string };
        const replayPayload = {
          ...durableFact,
          traceparent: traceparent(traceId, span.spanId),
        };
        connection.publish(subject, codec.encode(JSON.stringify(replayPayload)));
        await connection.flush();
        expect(JSON.parse(await receiveMessage(subscription))).toEqual(replayPayload);
        await connection.close();
        connection = undefined;
        expect(
          queryPostgres(
            `SELECT count(*) FROM foundation_conformance.fanout_facts WHERE event_id = ${eventIdSql}`
          )
        ).toBe('1');
      });

      const logs = runCompose('logs', '--no-color', '--tail=1000', 'api-gateway');
      expect(logs).toContain(correlationId);
      expect(logs).toContain(traceId);
    } catch (error) {
      testFailure = error;
      hasTestFailure = true;
    } finally {
      const cleanupErrors: unknown[] = [];
      finishSpan(rootSpan);
      try {
        exportTestSpans(traceId, spans);
        traceExported = true;
      } catch (error) {
        cleanupErrors.push(
          new Error('Failed to export the F4 conformance trace.', { cause: error })
        );
      }

      try {
        await connection?.close();
      } catch (error) {
        cleanupErrors.push(
          new Error('Failed to close the NATS conformance connection.', { cause: error })
        );
      }

      if (natsRecoveryNeeded) {
        try {
          runCompose('up', '-d', 'nats');
        } catch (error) {
          cleanupErrors.push(
            new Error('Failed to start NATS after the test outage.', { cause: error })
          );
        }
        try {
          await waitForNatsHealth(natsMonitorPort);
          natsRecoveryNeeded = false;
        } catch (error) {
          cleanupErrors.push(
            new Error('NATS did not become healthy after the test outage.', { cause: error })
          );
        }
      }

      if (factInserted) {
        try {
          queryPostgres(
            `DELETE FROM foundation_conformance.fanout_facts WHERE event_id = ${eventIdSql}`
          );
        } catch (error) {
          cleanupErrors.push(
            new Error('Failed to remove the test-owned PostgreSQL fact.', { cause: error })
          );
        }
      }

      if (hasTestFailure) {
        if (cleanupErrors.length > 0) {
          throw new AggregateError(
            [testFailure, ...cleanupErrors],
            'F4 conformance failed and cleanup reported additional errors.',
            { cause: testFailure }
          );
        }
        throw testFailure;
      }
      if (cleanupErrors.length === 1) throw cleanupErrors[0];
      if (cleanupErrors.length > 1) {
        throw new AggregateError(cleanupErrors, 'F4 conformance cleanup encountered errors.');
      }
    }

    if (traceExported) {
      await assertTraceInTempo(
        traceId,
        correlationId,
        [
          'f4.conformance.transaction',
          'f4.postgres.commit',
          'f4.gateway.health_request',
          'f4.gateway.metric_probe',
          'http.server.request',
          'f4.prometheus.assert_increment',
          'f4.nats.live_publish',
          'f4.nats.outage',
          'f4.nats.restart',
          'f4.nats.manual_replay',
        ],
        gatewayParentSpanIds
      );
    }
  }, 120_000);
});
