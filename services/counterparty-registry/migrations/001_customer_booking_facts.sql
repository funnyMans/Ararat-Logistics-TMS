CREATE TABLE counterparty_registry_stream_state (
  stream_key text PRIMARY KEY CHECK (stream_key = 'customer-booking-facts-v1'),
  last_committed_registry_sequence bigint NOT NULL DEFAULT 0
    CHECK (last_committed_registry_sequence >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO counterparty_registry_stream_state (stream_key)
VALUES ('customer-booking-facts-v1');

CREATE TABLE counterparties (
  counterparty_id uuid PRIMARY KEY,
  legal_name text NOT NULL CHECK (length(btrim(legal_name)) > 0),
  owner_revision bigint NOT NULL DEFAULT 1 CHECK (owner_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer_profiles (
  customer_id uuid PRIMARY KEY,
  counterparty_id uuid NOT NULL UNIQUE
    REFERENCES counterparties (counterparty_id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED')),
  owner_revision bigint NOT NULL CHECK (owner_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customer_profiles_by_status ON customer_profiles (status);

CREATE TABLE customer_profile_transitions (
  transition_id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customer_profiles (customer_id) ON DELETE RESTRICT,
  sequence_number bigint NOT NULL CHECK (sequence_number > 0),
  from_status text CHECK (from_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED')),
  to_status text NOT NULL CHECK (to_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED')),
  actor_principal_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  occurred_at timestamptz NOT NULL,
  UNIQUE (customer_id, sequence_number)
);

CREATE TABLE counterparty_registry_outbox (
  outbox_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id uuid NOT NULL UNIQUE,
  message_kind text NOT NULL CHECK (
    message_kind IN ('CUSTOMER_BOOKING_FACT', 'CUSTOMER_BOOKING_WATERMARK', 'CUSTOMER_BOOKING_SNAPSHOT')
  ),
  registry_sequence bigint CHECK (registry_sequence >= 0),
  routing_key text NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT counterparty_registry_outbox_sequence_shape CHECK (
    (message_kind = 'CUSTOMER_BOOKING_FACT' AND registry_sequence > 0)
    OR
    (message_kind <> 'CUSTOMER_BOOKING_FACT' AND registry_sequence IS NULL)
  )
);

CREATE INDEX counterparty_registry_outbox_pending_order
  ON counterparty_registry_outbox (outbox_id)
  WHERE state = 'pending';

CREATE TABLE customer_booking_snapshot_inbox (
  message_id uuid PRIMARY KEY,
  content_hash bytea NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer_booking_snapshot_quarantine (
  quarantine_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id uuid NOT NULL,
  original_content_hash bytea NOT NULL,
  conflicting_content_hash bytea NOT NULL,
  reason text NOT NULL,
  quarantined_at timestamptz NOT NULL DEFAULT now()
);
