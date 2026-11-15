import { createServer, type IncomingMessage, type Server } from 'node:http';
import { z } from 'zod';
import {
  EconomicEstimateIdConflictError,
  type EconomicEstimateRecordRepository,
} from '../../application/ports/economic-estimate-record-repository';
import { economicEstimateRecordInputSchema } from '../../domain/economic-estimate-record';

const collectionPath = '/internal/v1/estimate-records';
const maximumRequestBytes = 1_048_576;
const estimateListQuerySchema = z
  .object({
    loadId: z.uuid(),
    trioId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(100),
    cursor: z
      .string()
      .regex(/^[A-Za-z0-9_-]+\.[0-9a-f-]{36}$/i)
      .optional(),
  })
  .strict();

export interface OperationalEconomicsRuntimeHealth {
  startupComplete: boolean;
}

export type OperationalEconomicsReadinessProbe = () => Promise<boolean>;

class HttpInputError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string
  ) {
    super(message);
    this.name = 'HttpInputError';
  }
}

function sendJson(response: import('node:http').ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function sendError(
  response: import('node:http').ServerResponse,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): void {
  sendJson(response, statusCode, {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  });
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytesRead = 0;
    request.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytesRead += buffer.length;
      if (bytesRead > maximumRequestBytes) {
        reject(new HttpInputError('Request body exceeds the 1 MiB limit.', 413, 'body_too_large'));
        request.resume();
        return;
      }
      chunks.push(buffer);
    });
    request.on('end', () => {
      if (bytesRead > maximumRequestBytes) {
        return;
      }
      try {
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(body);
      } catch {
        reject(new HttpInputError('Request body must be valid JSON.', 400, 'invalid_json'));
      }
    });
    request.on('error', reject);
  });
}

function validationDetails(issues: z.ZodIssue[]) {
  return issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

function decodeCursor(
  cursor: string | undefined
): { recordedAt: string; estimateId: string } | null {
  if (!cursor) {
    return null;
  }
  const [encodedRecordedAt, estimateId] = cursor.split('.');
  if (!encodedRecordedAt || !estimateId || !z.uuid().safeParse(estimateId).success) {
    return null;
  }
  const recordedAt = Buffer.from(encodedRecordedAt, 'base64url').toString('utf8');
  if (!z.iso.datetime().safeParse(recordedAt).success) {
    return null;
  }
  return { recordedAt, estimateId };
}

function encodeCursor(estimate: { recordedAt: string; estimateId: string }): string {
  return `${Buffer.from(estimate.recordedAt).toString('base64url')}.${estimate.estimateId}`;
}

export function createOperationalEconomicsHttpServer(
  repository: EconomicEstimateRecordRepository,
  health: OperationalEconomicsRuntimeHealth,
  readinessProbe: OperationalEconomicsReadinessProbe,
  startedAt = Date.now()
): Server {
  return createServer((request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      console.error('Operational Economics request failed.', error);
      if (!response.headersSent) {
        sendError(response, 503, 'service_unavailable', 'The request could not be completed.');
      } else {
        response.destroy();
      }
    });
  });

  async function handleRequest(
    request: IncomingMessage,
    response: import('node:http').ServerResponse
  ): Promise<void> {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (request.method === 'GET' && request.url === '/ready') {
      try {
        const databaseReady = await readinessProbe();
        const ready = health.startupComplete && databaseReady;
        sendJson(response, ready ? 200 : 503, {
          ready,
          database: databaseReady ? 'ok' : 'unavailable',
          startupComplete: health.startupComplete,
        });
      } catch (error) {
        console.error('Operational Economics readiness database probe failed.', error);
        sendJson(response, 503, {
          ready: false,
          database: 'unavailable',
          startupComplete: health.startupComplete,
        });
      }
      return;
    }

    if (request.method === 'GET' && request.url === '/metrics') {
      try {
        const databaseReady = await readinessProbe();
        response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' });
        response.end(
          [
            '# HELP operational_economics_up Whether the service process is running.',
            '# TYPE operational_economics_up gauge',
            'operational_economics_up 1',
            '# HELP operational_economics_ready Whether startup and PostgreSQL are ready.',
            '# TYPE operational_economics_ready gauge',
            `operational_economics_ready ${health.startupComplete && databaseReady ? 1 : 0}`,
            '# HELP operational_economics_process_start_time_seconds Unix time when the process started.',
            '# TYPE operational_economics_process_start_time_seconds gauge',
            `operational_economics_process_start_time_seconds ${Math.floor(startedAt / 1000)}`,
            '',
          ].join('\n')
        );
      } catch (error) {
        console.error('Operational Economics metrics database probe failed.', error);
        response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('metrics unavailable\n');
      }
      return;
    }

    if (!request.url?.startsWith(collectionPath)) {
      sendError(response, 404, 'not_found', 'The requested resource was not found.');
      return;
    }

    if (request.method === 'POST' && request.url === collectionPath) {
      await createEstimateRecord(request, response);
      return;
    }

    if (request.method === 'GET') {
      await readEstimateRecords(request, response);
      return;
    }

    sendError(
      response,
      405,
      'method_not_allowed',
      'The HTTP method is not supported for this resource.'
    );
  }

  async function createEstimateRecord(
    request: IncomingMessage,
    response: import('node:http').ServerResponse
  ): Promise<void> {
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      sendError(response, 415, 'unsupported_media_type', 'Content-Type must be application/json.');
      return;
    }

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      if (error instanceof HttpInputError) {
        sendError(response, error.statusCode, error.code, error.message);
        return;
      }
      throw error;
    }

    const parsed = economicEstimateRecordInputSchema.safeParse(body);
    if (!parsed.success) {
      sendError(
        response,
        400,
        'invalid_estimate_record',
        'The estimate record does not match contract version 1.0.0.',
        validationDetails(parsed.error.issues)
      );
      return;
    }

    try {
      const result = await repository.create(parsed.data);
      sendJson(response, result.created ? 201 : 200, result.record);
    } catch (error) {
      if (error instanceof EconomicEstimateIdConflictError) {
        sendError(response, 409, 'estimate_id_conflict', error.message);
        return;
      }
      throw error;
    }
  }

  async function readEstimateRecords(
    request: IncomingMessage,
    response: import('node:http').ServerResponse
  ): Promise<void> {
    const requestUrl = new URL(request.url ?? '/', 'http://operational-economics.local');
    if (requestUrl.pathname === collectionPath) {
      const query = estimateListQuerySchema.safeParse(
        Object.fromEntries(requestUrl.searchParams.entries())
      );
      if (!query.success) {
        sendError(
          response,
          400,
          'invalid_query',
          'A valid loadId, optional trioId, and limit from 1 to 100 are required.',
          validationDetails(query.error.issues)
        );
        return;
      }
      const cursor = decodeCursor(query.data.cursor);
      if (query.data.cursor && !cursor) {
        sendError(response, 400, 'invalid_cursor', 'The estimate-list cursor is invalid.');
        return;
      }
      const estimatePage = await repository.findByLoad(
        query.data.loadId,
        query.data.trioId,
        query.data.limit + 1,
        cursor ?? undefined
      );
      const estimates = estimatePage.slice(0, query.data.limit);
      const hasMore = estimatePage.length > query.data.limit;
      const lastEstimate = estimates[estimates.length - 1];
      sendJson(response, 200, {
        estimates,
        hasMore,
        ...(hasMore && lastEstimate ? { nextCursor: encodeCursor(lastEstimate) } : {}),
      });
      return;
    }

    const match = /^\/internal\/v1\/estimate-records\/([^/]+)$/.exec(requestUrl.pathname);
    if (!match?.[1]) {
      sendError(response, 404, 'not_found', 'The requested resource was not found.');
      return;
    }

    let estimateId: string;
    try {
      estimateId = decodeURIComponent(match[1]);
    } catch {
      sendError(response, 400, 'invalid_estimate_id', 'The estimate ID must be a UUID.');
      return;
    }
    const parsedId = z.uuid().safeParse(estimateId);
    if (!parsedId.success) {
      sendError(response, 400, 'invalid_estimate_id', 'The estimate ID must be a UUID.');
      return;
    }
    const estimate = await repository.findById(parsedId.data);
    if (!estimate) {
      sendError(response, 404, 'estimate_not_found', 'The estimate record was not found.');
      return;
    }
    sendJson(response, 200, estimate);
  }
}
