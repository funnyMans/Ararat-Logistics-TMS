CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE reservations (
  reservation_id uuid PRIMARY KEY,
  reservation_revision bigint NOT NULL CHECK (
    reservation_revision BETWEEN 1 AND 9007199254740991
  ),
  planning_attempt_id uuid NOT NULL,
  trip_plan_id uuid NOT NULL,
  trip_plan_revision integer NOT NULL CHECK (trip_plan_revision >= 1),
  state text NOT NULL CHECK (state IN ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED', 'SUPERSEDED')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservations_expiry_matches_state CHECK (
    (state = 'HELD' AND expires_at = created_at + interval '5 minutes')
    OR
    (state <> 'HELD' AND expires_at IS NULL)
  )
);

CREATE INDEX reservations_expiring_holds
  ON reservations (expires_at, reservation_id)
  WHERE state = 'HELD';

CREATE TABLE reservation_transitions (
  transition_id uuid PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES reservations (reservation_id) ON DELETE RESTRICT,
  reservation_revision bigint NOT NULL CHECK (
    reservation_revision BETWEEN 1 AND 9007199254740991
  ),
  from_state text CHECK (
    from_state IS NULL OR from_state IN ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED', 'SUPERSEDED')
  ),
  to_state text NOT NULL CHECK (to_state IN ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED', 'SUPERSEDED')),
  reason_code text NOT NULL,
  command_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservation_transitions_revision_unique
    UNIQUE (reservation_id, reservation_revision)
);

CREATE FUNCTION reject_reservation_transition_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Reservation transition history is append-only.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservation_transitions_append_only
  BEFORE UPDATE OR DELETE ON reservation_transitions
  FOR EACH ROW EXECUTE FUNCTION reject_reservation_transition_mutation();

CREATE TABLE reservation_claims (
  claim_id uuid PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES reservations (reservation_id) ON DELETE RESTRICT,
  segment_sequence_number integer NOT NULL CHECK (segment_sequence_number > 0),
  resource_type text NOT NULL CHECK (resource_type IN ('POWER_UNIT', 'TRAILER', 'DRIVER')),
  resource_id uuid NOT NULL,
  resource_window tstzrange NOT NULL,
  claim_state text NOT NULL CHECK (claim_state IN ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED', 'SUPERSEDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservation_claim_unique_resource
    UNIQUE (reservation_id, segment_sequence_number, resource_type, resource_id),
  CONSTRAINT reservation_claim_window_finite_half_open CHECK (
    NOT isempty(resource_window)
    AND lower_inc(resource_window)
    AND NOT upper_inc(resource_window)
    AND NOT lower_inf(resource_window)
    AND NOT upper_inf(resource_window)
    AND isfinite(lower(resource_window))
    AND isfinite(upper(resource_window))
  ),
  CONSTRAINT reservation_claims_no_active_overlap
    EXCLUDE USING gist (
      resource_type WITH =,
      resource_id WITH =,
      resource_window WITH &&
    )
    WHERE (claim_state IN ('HELD', 'CONFIRMED'))
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX reservation_claims_by_reservation
  ON reservation_claims (reservation_id, segment_sequence_number);

CREATE FUNCTION enforce_reservation_transition() RETURNS trigger AS $$
BEGIN
  IF NEW.state = OLD.state THEN
    IF NEW.reservation_revision <> OLD.reservation_revision
      OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      RAISE EXCEPTION 'Reservation revisions and expiry may change only with a state transition.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.reservation_revision <> OLD.reservation_revision + 1 THEN
    RAISE EXCEPTION 'A reservation transition must increment its revision exactly once.';
  END IF;

  IF NOT (
    (OLD.state = 'HELD' AND NEW.state IN ('CONFIRMED', 'RELEASED', 'EXPIRED', 'SUPERSEDED'))
    OR
    (OLD.state = 'CONFIRMED' AND NEW.state IN ('RELEASED', 'SUPERSEDED'))
  ) THEN
    RAISE EXCEPTION 'Invalid reservation transition from % to %.', OLD.state, NEW.state;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservations_transition_guard
  BEFORE UPDATE OF state, reservation_revision, expires_at ON reservations
  FOR EACH ROW EXECUTE FUNCTION enforce_reservation_transition();

CREATE FUNCTION synchronize_reservation_claim_states() RETURNS trigger AS $$
BEGIN
  UPDATE reservation_claims
  SET claim_state = NEW.state
  WHERE reservation_id = NEW.reservation_id
    AND claim_state IS DISTINCT FROM NEW.state;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservations_sync_claim_states
  AFTER UPDATE OF state ON reservations
  FOR EACH ROW
  WHEN (OLD.state IS DISTINCT FROM NEW.state)
  EXECUTE FUNCTION synchronize_reservation_claim_states();

CREATE FUNCTION check_reservation_claim_state() RETURNS trigger AS $$
DECLARE
  head_state text;
BEGIN
  SELECT state INTO head_state
  FROM reservations
  WHERE reservation_id = NEW.reservation_id;

  IF head_state IS NULL OR NEW.claim_state <> head_state THEN
    RAISE EXCEPTION 'Reservation claims must match their reservation state.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservation_claims_match_head
  BEFORE INSERT OR UPDATE OF reservation_id, claim_state ON reservation_claims
  FOR EACH ROW EXECUTE FUNCTION check_reservation_claim_state();

CREATE FUNCTION prevent_reservation_claim_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Reservation claims are append-only.';
  END IF;

  IF NEW.claim_id IS DISTINCT FROM OLD.claim_id
    OR NEW.reservation_id IS DISTINCT FROM OLD.reservation_id
    OR NEW.segment_sequence_number IS DISTINCT FROM OLD.segment_sequence_number
    OR NEW.resource_type IS DISTINCT FROM OLD.resource_type
    OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
    OR NEW.resource_window IS DISTINCT FROM OLD.resource_window
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Reservation claim identity and window are immutable.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservation_claims_immutable
  BEFORE UPDATE OR DELETE ON reservation_claims
  FOR EACH ROW EXECUTE FUNCTION prevent_reservation_claim_mutation();

CREATE FUNCTION check_reservation_head_transition() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM reservation_transitions
    WHERE reservation_id = NEW.reservation_id
      AND reservation_revision = NEW.reservation_revision
      AND to_state = NEW.state
  ) THEN
    RAISE EXCEPTION 'Every reservation head revision must have a matching transition.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER reservation_head_has_transition
  AFTER INSERT OR UPDATE OF state, reservation_revision ON reservations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_reservation_head_transition();

CREATE TABLE capacity_command_inbox (
  inbox_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_service text NOT NULL CHECK (source_service = 'dispatch-planning'),
  message_type text NOT NULL CHECK (
    message_type IN (
      'capacity.reservation.reserve',
      'capacity.reservation.confirm',
      'capacity.reservation.release',
      'capacity.reservation.replace'
    )
  ),
  scope_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) > 0),
  command_id uuid NOT NULL UNIQUE,
  message_id uuid NOT NULL UNIQUE,
  request_hash bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  outcome_message_id uuid,
  outcome_routing_key text,
  outcome_payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT capacity_command_inbox_idempotency_unique
    UNIQUE (source_service, message_type, scope_id, idempotency_key),
  CONSTRAINT capacity_command_inbox_result_complete CHECK (
    (outcome_message_id IS NULL AND outcome_routing_key IS NULL AND outcome_payload IS NULL)
    OR
    (outcome_message_id IS NOT NULL AND outcome_routing_key IS NOT NULL AND outcome_payload IS NOT NULL)
  )
);

CREATE TABLE capacity_outbox (
  outbox_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id uuid NOT NULL UNIQUE,
  command_id uuid NOT NULL REFERENCES capacity_command_inbox (command_id) ON DELETE RESTRICT,
  routing_key text NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT capacity_outbox_publication_state CHECK (
    (state = 'pending' AND published_at IS NULL)
    OR
    (state = 'published' AND published_at IS NOT NULL)
  )
);

CREATE INDEX capacity_outbox_pending_order
  ON capacity_outbox (outbox_id)
  WHERE state = 'pending';
