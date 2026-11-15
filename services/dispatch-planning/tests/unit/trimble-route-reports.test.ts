import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  captureTrimbleRouteReportsResponse,
  createTrimbleRouteReportsRequest,
} from '../../src/infrastructure/routing/trimble-route-reports';

const probeInput = {
  laneReference: 'lane-west-01',
  dataVersion: 'Current',
  vehicleProfileReference: 'profile:tractor-53ft:v3',
  routeOptions: { VehicleType: 0, DistanceUnits: 0 },
  stops: [
    { stopId: 'origin', latitude: 34.0522, longitude: -118.2437 },
    { stopId: 'destination', latitude: 36.1699, longitude: -115.1398 },
  ],
};

describe('Trimble Route Reports sandbox harness', () => {
  it('builds a provider request without performing a network call or embedding credentials', () => {
    const request = createTrimbleRouteReportsRequest(probeInput);

    expect(request.url).toBe(
      'https://pcmiler.alk.com/apis/rest/v1.0/Service.svc/route/routeReports?dataVersion=Current'
    );
    expect(request.method).toBe('POST');
    expect(request.body).toEqual({
      VehicleType: 0,
      DistanceUnits: 0,
      Stops: [
        { ID: 'origin', Coords: { Lat: 34.0522, Lon: -118.2437 } },
        { ID: 'destination', Coords: { Lat: 36.1699, Lon: -115.1398 } },
      ],
      ReportTypes: ['Mileage', 'Detailed'],
    });
    expect(JSON.stringify(request)).not.toMatch(/api.?key|authorization|password/i);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.body.Stops)).toBe(true);
    expect(Object.isFrozen(request.body.Stops?.[0])).toBe(true);
  });

  it('captures provider response provenance over the exact request and response bytes', () => {
    const request = createTrimbleRouteReportsRequest(probeInput);
    const responseBody = '[{"Report":"Mileage","Errors":[]}]';
    const captured = captureTrimbleRouteReportsResponse(request, {
      status: 200,
      requestedAt: '2026-11-10T11:59:59.000Z',
      receivedAt: '2026-11-10T12:00:00.000Z',
      body: responseBody,
    });

    expect(captured.provenance).toMatchObject({
      provider: 'TRIMBLE_MAPS_PC_MILER',
      laneReference: 'lane-west-01',
      vehicleProfileReference: 'profile:tractor-53ft:v3',
      dataVersion: 'Current',
      httpStatus: 200,
      requestSha256: createHash('sha256').update(request.bodyText).digest('hex'),
      responseSha256: createHash('sha256').update(responseBody).digest('hex'),
      requestedAt: '2026-11-10T11:59:59.000Z',
      receivedAt: '2026-11-10T12:00:00.000Z',
    });
    expect(captured.response).toEqual([{ Report: 'Mileage', Errors: [] }]);
    expect(Object.isFrozen(captured.response)).toBe(true);
  });

  it('rejects invalid coordinates, omitted profile options, and malformed provider JSON', () => {
    expect(() =>
      createTrimbleRouteReportsRequest({
        ...probeInput,
        stops: [{ ...probeInput.stops[0], latitude: 91 }, probeInput.stops[1]],
      })
    ).toThrow();
    expect(() => createTrimbleRouteReportsRequest({ ...probeInput, routeOptions: {} })).toThrow();

    const request = createTrimbleRouteReportsRequest(probeInput);
    expect(() =>
      captureTrimbleRouteReportsResponse(request, {
        status: 200,
        requestedAt: '2026-11-10T12:00:00.000Z',
        receivedAt: '2026-11-10T12:00:00.000Z',
        body: 'not-json',
      })
    ).toThrow(/valid JSON/);
  });

  it('rejects failed or oversized provider responses', () => {
    const request = createTrimbleRouteReportsRequest(probeInput);
    expect(() =>
      captureTrimbleRouteReportsResponse(request, {
        status: 503,
        requestedAt: '2026-11-10T12:00:00.000Z',
        receivedAt: '2026-11-10T12:00:00.000Z',
        body: '{"error":"unavailable"}',
      })
    ).toThrow(/HTTP 503/);
    expect(() =>
      captureTrimbleRouteReportsResponse(request, {
        status: 200,
        requestedAt: '2026-11-10T12:00:00.000Z',
        receivedAt: '2026-11-10T12:00:00.000Z',
        body: ' '.repeat(5 * 1024 * 1024 + 1),
      })
    ).toThrow(/exceeds the capture limit/);
  });
});
