import { createHash } from 'node:crypto';
import { z } from 'zod';

const TRIMBLE_ROUTE_REPORTS_URL =
  'https://pcmiler.alk.com/apis/rest/v1.0/Service.svc/route/routeReports';
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const RESERVED_ROUTE_OPTIONS = new Set(['Stops', 'ReportTypes']);

const stopSchema = z.strictObject({
  stopId: z.string().trim().min(1),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const routeProbeInputSchema = z.strictObject({
  laneReference: z.string().trim().min(1),
  dataVersion: z.string().trim().min(1),
  vehicleProfileReference: z.string().trim().min(1),
  routeOptions: z
    .record(z.string(), z.json())
    .refine(
      (options) => Object.keys(options).length > 0,
      'At least one explicit route option is required.'
    )
    .refine(
      (options) => !Object.keys(options).some((key) => RESERVED_ROUTE_OPTIONS.has(key)),
      'Route options cannot override Stops or ReportTypes.'
    ),
  stops: z.array(stopSchema).min(2).max(10_000),
});

const capturedResponseSchema = z.strictObject({
  status: z.number().int().min(100).max(599),
  requestedAt: z.iso.datetime({ offset: true }),
  receivedAt: z.iso.datetime({ offset: true }),
  body: z.string(),
});

export type TrimbleRouteReportsProbeInput = z.input<typeof routeProbeInputSchema>;
export type TrimbleRouteReportsProbeRequest = Readonly<{
  provider: 'TRIMBLE_MAPS_PC_MILER';
  laneReference: string;
  vehicleProfileReference: string;
  dataVersion: string;
  url: string;
  method: 'POST';
  contentType: 'application/json';
  body: Readonly<
    Record<string, unknown> & {
      Stops: readonly Readonly<{
        ID: string;
        Coords: Readonly<{ Lat: number; Lon: number }>;
      }>[];
      ReportTypes: readonly ['Mileage', 'Detailed'];
    }
  >;
  bodyText: string;
}>;

export type TrimbleRouteReportsCapturedResponse = Readonly<{
  response: unknown;
  provenance: Readonly<{
    provider: 'TRIMBLE_MAPS_PC_MILER';
    laneReference: string;
    vehicleProfileReference: string;
    dataVersion: string;
    httpStatus: number;
    requestSha256: string;
    responseSha256: string;
    receivedAt: string;
  }>;
}>;

export class TrimbleRouteReportsCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrimbleRouteReportsCaptureError';
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0
    );
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nestedValue of Object.values(value)) {
      deepFreeze(nestedValue);
    }
    Object.freeze(value);
  }
  return value;
}

export function createTrimbleRouteReportsRequest(
  input: TrimbleRouteReportsProbeInput
): TrimbleRouteReportsProbeRequest {
  const parsed = routeProbeInputSchema.parse(input);
  const url = new URL(TRIMBLE_ROUTE_REPORTS_URL);
  url.searchParams.set('dataVersion', parsed.dataVersion);

  const body = deepFreeze({
    ...parsed.routeOptions,
    Stops: parsed.stops.map(({ stopId, latitude, longitude }) => ({
      ID: stopId,
      Coords: { Lat: latitude, Lon: longitude },
    })),
    ReportTypes: ['Mileage', 'Detailed'] as const,
  });
  const bodyText = stableJson(body);

  return Object.freeze({
    provider: 'TRIMBLE_MAPS_PC_MILER',
    laneReference: parsed.laneReference,
    vehicleProfileReference: parsed.vehicleProfileReference,
    dataVersion: parsed.dataVersion,
    url: url.toString(),
    method: 'POST',
    contentType: 'application/json',
    body,
    bodyText,
  });
}

export function captureTrimbleRouteReportsResponse(
  request: TrimbleRouteReportsProbeRequest,
  input: z.input<typeof capturedResponseSchema>
): TrimbleRouteReportsCapturedResponse {
  const parsed = capturedResponseSchema.parse(input);
  if (Date.parse(parsed.receivedAt) < Date.parse(parsed.requestedAt)) {
    throw new TrimbleRouteReportsCaptureError(
      'Trimble Route Reports response time precedes the request time.'
    );
  }
  if (Buffer.byteLength(parsed.body, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new TrimbleRouteReportsCaptureError(
      `Trimble Route Reports response exceeds the capture limit of ${MAX_RESPONSE_BYTES} bytes.`
    );
  }
  if (parsed.status < 200 || parsed.status >= 300) {
    throw new TrimbleRouteReportsCaptureError(
      `Trimble Route Reports returned HTTP ${parsed.status}; the response was not accepted as route evidence.`
    );
  }

  let response: unknown;
  try {
    response = JSON.parse(parsed.body);
  } catch (error) {
    throw new TrimbleRouteReportsCaptureError(
      `Trimble Route Reports response is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return Object.freeze({
    response: deepFreeze(response),
    provenance: Object.freeze({
      provider: request.provider,
      laneReference: request.laneReference,
      vehicleProfileReference: request.vehicleProfileReference,
      dataVersion: request.dataVersion,
      httpStatus: parsed.status,
      requestSha256: sha256(request.bodyText),
      responseSha256: sha256(parsed.body),
      requestedAt: parsed.requestedAt,
      receivedAt: parsed.receivedAt,
    }),
  });
}
