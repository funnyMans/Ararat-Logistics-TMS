CREATE TABLE load_customer_booking_projection_state (
  stream_key text PRIMARY KEY CHECK (stream_key = 'counterparty-customer-booking-facts-v1'),
  initialized boolean NOT NULL DEFAULT false,
  contiguous_registry_sequence bigint NOT NULL DEFAULT 0 CHECK (contiguous_registry_sequence >= 0),
  observed_registry_sequence bigint NOT NULL DEFAULT 0 CHECK (observed_registry_sequence >= 0),
  last_watermark_sequence bigint NOT NULL DEFAULT 0 CHECK (last_watermark_sequence >= 0),
  last_watermark_at timestamptz,
  stream_stale boolean NOT NULL DEFAULT true,
  reconciliation_sequence bigint CHECK (reconciliation_sequence >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO load_customer_booking_projection_state (stream_key)
VALUES ('counterparty-customer-booking-facts-v1');

CREATE TABLE load_customer_booking_facts (
  customer_id uuid PRIMARY KEY,
  result text NOT NULL CHECK (result IN ('FOUND', 'NOT_FOUND')),
  status text,
  legal_name text,
  owner_revision bigint NOT NULL DEFAULT 0 CHECK (owner_revision >= 0),
  registry_sequence bigint NOT NULL CHECK (registry_sequence >= 0),
  stale boolean NOT NULL,
  observed_owner_revision bigint NOT NULL DEFAULT 0 CHECK (observed_owner_revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT load_customer_booking_facts_result_shape CHECK (
    (result = 'FOUND' AND status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED')
      AND status IS NOT NULL AND legal_name IS NOT NULL AND length(btrim(legal_name)) > 0
      AND (owner_revision > 0 OR stale))
    OR
    (result = 'NOT_FOUND' AND status IS NULL AND legal_name IS NULL AND owner_revision = 0)
  )
);

CREATE TABLE load_customer_booking_fact_inbox (
  message_id uuid PRIMARY KEY,
  content_hash bytea NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE load_customer_booking_fact_quarantine (
  quarantine_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id uuid NOT NULL,
  original_content_hash bytea NOT NULL,
  conflicting_content_hash bytea NOT NULL,
  reason text NOT NULL,
  quarantined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE load_customer_booking_snapshot_outbox (
  message_id uuid PRIMARY KEY,
  customer_id uuid NOT NULL,
  reason text NOT NULL CHECK (
    reason IN ('MISSING', 'REVISION_GAP', 'REGISTRY_SEQUENCE_GAP', 'STALE', 'STREAM_GAP')
  ),
  last_applied_owner_revision bigint NOT NULL CHECK (last_applied_owner_revision >= 0),
  minimum_registry_sequence bigint NOT NULL CHECK (minimum_registry_sequence >= 0),
  observed_owner_revision bigint CHECK (observed_owner_revision > 0),
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'published', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE UNIQUE INDEX load_customer_booking_snapshot_pending_request
  ON load_customer_booking_snapshot_outbox (
    customer_id,
    reason,
    minimum_registry_sequence,
    COALESCE(observed_owner_revision, 0)
  )
  WHERE state = 'pending';

CREATE INDEX load_customer_booking_fact_stale
  ON load_customer_booking_facts (customer_id)
  WHERE stale;
