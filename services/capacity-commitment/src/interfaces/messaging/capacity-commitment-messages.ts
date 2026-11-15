import { z } from 'zod';

const uuidV7 = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const utcTimestamp = z
  .string()
  .datetime({ offset: true })
  .refine((value) => value.endsWith('Z'), 'Timestamp must use UTC with a Z suffix.');
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

const commandEnvelope = {
  schemaVersion: z.literal('1.0.0'),
  sourceService: z.literal('dispatch-planning'),
  targetService: z.literal('capacity-commitment'),
  messageId: uuidV7,
  messageType: z.string(),
  issuedAt: z.string().datetime({ offset: true }),
  correlationId: uuidV7,
  causationId: uuidV7.optional(),
  commandId: uuidV7,
  idempotencyKey: z.string().min(1),
  initiatingPrincipalId: uuidV7.optional(),
};

const segmentSchema = z
  .object({
    sequenceNumber: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    startStopId: uuidV7,
    endStopId: uuidV7,
    timeWindow: z
      .object({
        startAt: utcTimestamp,
        endAt: utcTimestamp,
      })
      .strict()
      .refine(
        ({ startAt, endAt }) => Date.parse(startAt) < Date.parse(endAt),
        'Segment endAt must be later than startAt.'
      ),
    powerUnitId: uuidV7,
    trailerId: uuidV7,
    driverIds: z
      .array(uuidV7)
      .min(1)
      .max(2)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Driver IDs must be unique within a segment.'
      ),
    resourceReadinessRevisions: z
      .array(
        z
          .object({
            resourceType: z.enum(['POWER_UNIT', 'TRAILER', 'DRIVER']),
            resourceId: uuidV7,
            ownerRevision: revision,
          })
          .strict()
      )
      .min(3)
      .max(4)
      .refine(
        (resources) =>
          new Set(resources.map(({ resourceType, resourceId }) => `${resourceType}:${resourceId}`))
            .size === resources.length,
        'Readiness revisions must identify unique resources.'
      ),
  })
  .strict()
  .superRefine((segment, context) => {
    const expected = new Set([
      `POWER_UNIT:${segment.powerUnitId}`,
      `TRAILER:${segment.trailerId}`,
      ...segment.driverIds.map((driverId) => `DRIVER:${driverId}`),
    ]);
    const provided = new Set(
      segment.resourceReadinessRevisions.map(
        ({ resourceType, resourceId }) => `${resourceType}:${resourceId}`
      )
    );
    if (
      expected.size !== provided.size ||
      [...expected].some((resource) => !provided.has(resource))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['resourceReadinessRevisions'],
        message: 'A readiness revision is required for every assigned resource and no others.',
      });
    }
  });

const completeSegments = z
  .array(segmentSchema)
  .min(1)
  .superRefine((segments, context) => {
    segments.forEach((segment, index) => {
      if (segment.sequenceNumber !== index + 1) {
        context.addIssue({
          code: 'custom',
          path: [index, 'sequenceNumber'],
          message: 'Segments must be ordered with contiguous one-based sequence numbers.',
        });
      }
    });
  });

const reserveCommandSchema = z
  .object({
    ...commandEnvelope,
    messageType: z.literal('capacity.reservation.reserve'),
    payload: z
      .object({
        planningAttemptId: uuidV7,
        tripPlanId: uuidV7,
        tripPlanRevision: revision,
        segments: completeSegments,
      })
      .strict(),
  })
  .strict();

const mutationFields = {
  reservationId: uuidV7,
  reservationRevision: revision,
  tripPlanId: uuidV7,
  tripPlanRevision: revision,
};

const confirmCommandSchema = z
  .object({
    ...commandEnvelope,
    messageType: z.literal('capacity.reservation.confirm'),
    payload: z.object(mutationFields).strict(),
  })
  .strict();

const releaseCommandSchema = z
  .object({
    ...commandEnvelope,
    messageType: z.literal('capacity.reservation.release'),
    payload: z.object(mutationFields).strict(),
  })
  .strict();

const replaceCommandSchema = z
  .object({
    ...commandEnvelope,
    messageType: z.literal('capacity.reservation.replace'),
    payload: z
      .object({
        ...mutationFields,
        segments: completeSegments,
      })
      .strict(),
  })
  .strict();

export const capacityCommitmentCommandSchema = z.discriminatedUnion('messageType', [
  reserveCommandSchema,
  confirmCommandSchema,
  releaseCommandSchema,
  replaceCommandSchema,
]);

export type CapacityCommitmentCommand = z.infer<typeof capacityCommitmentCommandSchema>;
export type CapacitySegment = z.infer<typeof segmentSchema>;
export type CapacityResourceType = 'POWER_UNIT' | 'TRAILER' | 'DRIVER';

export function capacityCommandScopeId(command: CapacityCommitmentCommand): string {
  return command.messageType === 'capacity.reservation.reserve'
    ? command.payload.planningAttemptId
    : command.payload.reservationId;
}

export function getSegmentResources(
  segment: CapacitySegment
): Array<{ resourceType: CapacityResourceType; resourceId: string }> {
  return [
    { resourceType: 'POWER_UNIT', resourceId: segment.powerUnitId },
    { resourceType: 'TRAILER', resourceId: segment.trailerId },
    ...segment.driverIds.map((resourceId) => ({ resourceType: 'DRIVER' as const, resourceId })),
  ];
}

export function findOverlappingSegmentResources(segments: CapacitySegment[]) {
  const conflicts: Array<{
    sequenceNumber: number;
    resourceType: CapacityResourceType;
    resourceId: string;
  }> = [];
  const claims = segments.flatMap((segment) =>
    getSegmentResources(segment).map((resource) => ({
      ...resource,
      sequenceNumber: segment.sequenceNumber,
      startAt: Date.parse(segment.timeWindow.startAt),
      endAt: Date.parse(segment.timeWindow.endAt),
    }))
  );

  for (let leftIndex = 0; leftIndex < claims.length; leftIndex += 1) {
    const left = claims[leftIndex];
    if (!left) {
      continue;
    }
    for (let rightIndex = leftIndex + 1; rightIndex < claims.length; rightIndex += 1) {
      const right = claims[rightIndex];
      if (
        right &&
        left.sequenceNumber !== right.sequenceNumber &&
        left.resourceType === right.resourceType &&
        left.resourceId === right.resourceId &&
        left.startAt < right.endAt &&
        right.startAt < left.endAt
      ) {
        conflicts.push({
          sequenceNumber: right.sequenceNumber,
          resourceType: right.resourceType,
          resourceId: right.resourceId,
        });
      }
    }
  }

  return conflicts.filter(
    (conflict, index) =>
      conflicts.findIndex(
        (candidate) =>
          candidate.sequenceNumber === conflict.sequenceNumber &&
          candidate.resourceType === conflict.resourceType &&
          candidate.resourceId === conflict.resourceId
      ) === index
  );
}
