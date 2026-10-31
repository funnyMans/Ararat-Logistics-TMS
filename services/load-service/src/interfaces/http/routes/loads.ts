import type { FastifyInstance, FastifyReply } from 'fastify';
import { LoadAccessDeniedError } from '../../../domain/authorization/load-access-policy';
import { LoadResourceNotFoundError, LoadReads } from '../../../application/queries/load-reads';
import {
  BookingCorrectionNotFoundError,
  InvalidBookingAreaError,
  InvalidBookingSubmissionError,
  SubmitBooking,
} from '../../../application/commands/submit-booking';
import type { LoadBookingSubmissionRequest } from '../../../application/ports/load-booking-ports';

type ParsedBookingSubmissionRequest = Omit<LoadBookingSubmissionRequest, 'idempotencyKey'>;

function sendLoadError(error: unknown, reply: FastifyReply): unknown {
  if (error instanceof LoadAccessDeniedError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message:
          error.statusCode === 404
            ? 'The requested resource was not found.'
            : error.statusCode === 400
              ? 'The pickup location could not be assigned to a supported area.'
              : 'The request is not authorized.',
      },
    });
  }

  if (error instanceof LoadResourceNotFoundError) {
    return reply.status(404).send({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  }

  if (error instanceof BookingCorrectionNotFoundError) {
    return reply.status(404).send({
      error: {
        code: 'BOOKING_CORRECTION_NOT_FOUND',
        message: 'The rejected booking submission was not found.',
      },
    });
  }

  if (error instanceof InvalidBookingAreaError) {
    return reply.status(400).send({
      error: {
        code: 'INVALID_AREA',
        message: 'The pickup location could not be resolved or the asserted area does not match.',
      },
    });
  }

  if (error instanceof InvalidBookingSubmissionError) {
    return reply.status(400).send({
      error: {
        code: 'INVALID_BOOKING_REQUEST',
        message: 'A non-empty rows array and Idempotency-Key are required.',
      },
    });
  }

  throw error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBookingSubmissionRequest(body: unknown): ParsedBookingSubmissionRequest | null {
  if (!isRecord(body)) {
    return null;
  }

  const correctionOfSubmissionId = body.correctionOfSubmissionId;
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return null;
  }

  if (typeof correctionOfSubmissionId === 'string') {
    return { rows: body.rows, correctionOfSubmissionId };
  }
  if (correctionOfSubmissionId !== undefined && correctionOfSubmissionId !== null) {
    return null;
  }

  return {
    rows: body.rows,
    ...(correctionOfSubmissionId === null ? { correctionOfSubmissionId: null } : {}),
  };
}

export function registerLoadReadRoutes(
  server: FastifyInstance,
  reads: LoadReads,
  submitBooking?: SubmitBooking
): void {
  if (submitBooking) {
    server.post('/api/v1/booking-submissions', async (request, reply) => {
      if (!request.identity) {
        return reply.status(401).send({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'A valid bearer token is required.',
          },
        });
      }

      const input = parseBookingSubmissionRequest(request.body);
      const idempotencyKey = request.headers['idempotency-key'];
      if (!input || typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_BOOKING_REQUEST',
            message: 'A non-empty rows array and Idempotency-Key are required.',
          },
        });
      }

      try {
        const result = await submitBooking.execute(request.identity, {
          ...input,
          idempotencyKey,
        });
        if (!result.replayed) {
          reply.header(
            'Location',
            `/api/v1/booking-submissions/${encodeURIComponent(result.submissionId)}`
          );
        }
        return reply.status(result.replayed ? 200 : 201).send(result.representation);
      } catch (error) {
        return sendLoadError(error, reply);
      }
    });
  }

  server.get<{ Params: { loadId: string } }>('/api/v1/loads/:loadId', async (request, reply) => {
    if (!request.identity) {
      return reply.status(401).send({
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'A valid bearer token is required.' },
      });
    }

    try {
      return await reads.getLoad(request.identity, request.params.loadId);
    } catch (error) {
      return sendLoadError(error, reply);
    }
  });

  server.get<{
    Params: { loadId: string; revisionId: string };
  }>('/api/v1/loads/:loadId/revisions/:revisionId', async (request, reply) => {
    if (!request.identity) {
      return reply.status(401).send({
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'A valid bearer token is required.' },
      });
    }

    try {
      return await reads.getRevision(
        request.identity,
        request.params.loadId,
        request.params.revisionId
      );
    } catch (error) {
      return sendLoadError(error, reply);
    }
  });

  server.get<{
    Params: { submissionId: string };
  }>('/api/v1/booking-submissions/:submissionId', async (request, reply) => {
    if (!request.identity) {
      return reply.status(401).send({
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'A valid bearer token is required.' },
      });
    }

    try {
      return await reads.getBookingSubmission(request.identity, request.params.submissionId);
    } catch (error) {
      return sendLoadError(error, reply);
    }
  });
}
