export const CAPACITY_COMMAND_ROUTING_KEYS = [
  'capacity.reservation.reserve.v1',
  'capacity.reservation.confirm.v1',
  'capacity.reservation.release.v1',
  'capacity.reservation.replace.v1',
] as const;

export const CAPACITY_OUTCOME_ROUTING_KEYS = [
  'capacity.reservation.reserve.outcome.v1',
  'capacity.reservation.confirm.outcome.v1',
  'capacity.reservation.release.outcome.v1',
  'capacity.reservation.replace.outcome.v1',
] as const;

export const CAPACITY_COMMAND_EXCHANGE = 'dispatch.commands';
export const CAPACITY_COMMAND_QUEUE = 'capacity.commitment.commands';
export const CAPACITY_OUTCOME_EXCHANGE = 'capacity.commitment.outcomes';
export const CAPACITY_OUTCOME_QUEUE = 'dispatch.capacity-commitment.outcomes';
export const CAPACITY_RABBITMQ_VHOST = 'capacity_commitment';
