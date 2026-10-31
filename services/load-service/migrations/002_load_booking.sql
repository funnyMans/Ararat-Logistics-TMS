CREATE SEQUENCE load_reference_sequence START WITH 100000;

CREATE TABLE booking_submissions (
  submission_id uuid PRIMARY KEY,
  initiating_principal_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
  normalized_content_hash bytea NOT NULL CHECK (octet_length(normalized_content_hash) = 32),
  correction_of_submission_id uuid,
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'rejected')),
  input_schema_version text NOT NULL,
  normalized_input jsonb NOT NULL,
  result_schema_version text NOT NULL,
  result_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_submissions_idempotency UNIQUE (initiating_principal_id, idempotency_key),
  CONSTRAINT booking_submissions_correction_fk
    FOREIGN KEY (correction_of_submission_id)
    REFERENCES booking_submissions (submission_id)
    ON DELETE RESTRICT
);

CREATE TABLE loads (
  load_id uuid PRIMARY KEY,
  load_reference text NOT NULL UNIQUE,
  booking_submission_id uuid NOT NULL REFERENCES booking_submissions (submission_id),
  source_row_number integer NOT NULL CHECK (source_row_number > 0),
  area_id text NOT NULL CHECK (
    area_id IN (
      'la', 'pacific', 'mountain', 'west_north_central', 'east_north_central',
      'west_south_central', 'east_south_central', 'new_england',
      'middle_atlantic', 'south_atlantic'
    )
  ),
  area_mapping_revision text NOT NULL,
  handling_broker_principal_id uuid NOT NULL,
  current_revision_id uuid NOT NULL,
  lifecycle_status text NOT NULL CHECK (
    lifecycle_status IN ('BOOKED', 'CANCELLATION_PENDING', 'CANCELLED', 'COMPLETED')
  ),
  owner_revision bigint NOT NULL CHECK (owner_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loads_submission_row_unique UNIQUE (booking_submission_id, source_row_number)
);

CREATE INDEX loads_lifecycle_created
  ON loads (lifecycle_status, created_at DESC, load_id);

CREATE INDEX booking_submissions_correction
  ON booking_submissions (correction_of_submission_id)
  WHERE correction_of_submission_id IS NOT NULL;

CREATE TABLE booking_submission_areas (
  submission_id uuid NOT NULL REFERENCES booking_submissions (submission_id) ON DELETE CASCADE,
  source_row_number integer NOT NULL CHECK (source_row_number > 0),
  area_id text NOT NULL CHECK (
    area_id IN (
      'la', 'pacific', 'mountain', 'west_north_central', 'east_north_central',
      'west_south_central', 'east_south_central', 'new_england',
      'middle_atlantic', 'south_atlantic'
    )
  ),
  PRIMARY KEY (submission_id, source_row_number)
);

CREATE TABLE load_revisions (
  revision_id uuid PRIMARY KEY,
  load_id uuid NOT NULL REFERENCES loads (load_id),
  revision_number integer NOT NULL CHECK (revision_number > 0),
  construction_state text NOT NULL CHECK (construction_state IN ('BUILDING', 'COMMITTED')),
  customer_id uuid NOT NULL,
  customer_name_snapshot text NOT NULL CHECK (length(btrim(customer_name_snapshot)) > 0),
  customer_reference text,
  customer_rate_amount numeric(12, 2) NOT NULL CHECK (customer_rate_amount > 0),
  customer_rate_currency text NOT NULL CHECK (customer_rate_currency = 'USD'),
  equipment_profile text CHECK (
    equipment_profile IS NULL OR
    equipment_profile IN ('DRY_VAN', 'REEFER', 'FLATBED', 'STEP_DECK', 'TANKER')
  ),
  total_gross_weight_value numeric(12, 3),
  total_gross_weight_unit text,
  temperature_minimum numeric(5, 2),
  temperature_maximum numeric(5, 2),
  temperature_unit text,
  reefer_mode text CHECK (reefer_mode IS NULL OR reefer_mode IN ('CONTINUOUS', 'START_STOP')),
  tarp_required boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT load_revisions_same_load_unique UNIQUE (load_id, revision_id),
  CONSTRAINT load_revisions_number_unique UNIQUE (load_id, revision_number),
  CONSTRAINT load_revisions_weight_pair CHECK (
    (total_gross_weight_value IS NULL AND total_gross_weight_unit IS NULL)
    OR
    (total_gross_weight_value IS NOT NULL AND total_gross_weight_value > 0
      AND total_gross_weight_unit IS NOT NULL AND total_gross_weight_unit IN ('LB', 'KG'))
  ),
  CONSTRAINT load_revisions_temperature_group CHECK (
    (temperature_minimum IS NULL AND temperature_maximum IS NULL AND temperature_unit IS NULL)
    OR
    (temperature_minimum IS NOT NULL AND temperature_maximum IS NOT NULL
      AND temperature_unit IS NOT NULL AND temperature_minimum <= temperature_maximum
      AND temperature_unit IN ('F', 'C'))
  )
);

ALTER TABLE loads
  ADD CONSTRAINT loads_current_revision_same_load_fk
  FOREIGN KEY (load_id, current_revision_id)
  REFERENCES load_revisions (load_id, revision_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE load_revision_stops (
  stop_id uuid PRIMARY KEY,
  revision_id uuid NOT NULL REFERENCES load_revisions (revision_id),
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  stop_type text NOT NULL CHECK (stop_type IN ('PICKUP', 'DELIVERY')),
  address_line1 text NOT NULL CHECK (length(btrim(address_line1)) BETWEEN 1 AND 200),
  address_line2 text CHECK (address_line2 IS NULL OR length(btrim(address_line2)) <= 200),
  city text NOT NULL CHECK (length(btrim(city)) BETWEEN 1 AND 120),
  state_code text NOT NULL CHECK (
    state_code IN (
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
      'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
      'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
      'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
      'WI', 'WY', 'DC'
    )
  ),
  postal_code text NOT NULL CHECK (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  country_code text NOT NULL CHECK (country_code = 'US'),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  appointment_start_at timestamptz NOT NULL,
  appointment_end_at timestamptz NOT NULL,
  time_zone text NOT NULL,
  facility_name text,
  contact_name text,
  contact_phone text,
  access_instructions text,
  CONSTRAINT load_revision_stops_sequence_unique UNIQUE (revision_id, sequence_number),
  CONSTRAINT load_revision_stops_window_valid CHECK (appointment_end_at > appointment_start_at),
  CONSTRAINT load_revision_stops_coordinates_pair CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR
    (latitude IS NOT NULL AND longitude IS NOT NULL
      AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  )
);

CREATE TABLE load_revision_freight_lines (
  freight_line_id uuid PRIMARY KEY,
  revision_id uuid NOT NULL REFERENCES load_revisions (revision_id),
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 500),
  quantity numeric(12, 0) NOT NULL CHECK (quantity > 0),
  handling_unit_code text NOT NULL CHECK (
    handling_unit_code IN (
      'PALLET', 'SKID', 'CASE', 'CARTON', 'BOX', 'PIECE', 'CRATE', 'DRUM',
      'BAG', 'ROLL', 'CONTAINER', 'OTHER'
    )
  ),
  handling_unit_description text,
  stackable boolean NOT NULL,
  length numeric(10, 2),
  width numeric(10, 2),
  height numeric(10, 2),
  dimension_unit text,
  CONSTRAINT load_revision_freight_lines_sequence_unique UNIQUE (revision_id, sequence_number),
  CONSTRAINT load_revision_freight_lines_other_description CHECK (
    (handling_unit_code = 'OTHER' AND length(btrim(handling_unit_description)) > 0)
    OR
    (handling_unit_code <> 'OTHER' AND handling_unit_description IS NULL)
  ),
  CONSTRAINT load_revision_freight_lines_dimensions_group CHECK (
    (length IS NULL AND width IS NULL AND height IS NULL AND dimension_unit IS NULL)
    OR
    (length IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL AND dimension_unit IS NOT NULL
      AND length > 0 AND width > 0 AND height > 0 AND dimension_unit IN ('IN', 'CM'))
  )
);

CREATE TABLE load_revision_special_handling_codes (
  revision_id uuid NOT NULL REFERENCES load_revisions (revision_id),
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  code text NOT NULL CHECK (code IN ('OVERSIZE', 'HAZMAT')),
  PRIMARY KEY (revision_id, code),
  CONSTRAINT load_revision_special_handling_sequence_unique UNIQUE (revision_id, sequence_number)
);

CREATE TABLE load_lifecycle_transitions (
  transition_id uuid PRIMARY KEY,
  load_id uuid NOT NULL REFERENCES loads (load_id),
  transition_number bigint NOT NULL CHECK (transition_number > 0),
  from_status text,
  to_status text NOT NULL CHECK (
    to_status IN ('BOOKED', 'CANCELLATION_PENDING', 'CANCELLED', 'COMPLETED')
  ),
  reason_code text NOT NULL,
  actor_principal_id uuid,
  source text NOT NULL,
  correlation_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT load_lifecycle_transitions_number_unique UNIQUE (load_id, transition_number),
  CONSTRAINT load_lifecycle_transitions_initial_status CHECK (
    (transition_number = 1 AND from_status IS NULL AND to_status = 'BOOKED')
    OR
    (transition_number > 1 AND from_status IS NOT NULL)
  )
);

CREATE TABLE load_outbox (
  message_id uuid PRIMARY KEY,
  load_id uuid NOT NULL REFERENCES loads (load_id),
  owner_revision bigint NOT NULL CHECK (owner_revision > 0),
  message_type text NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT load_outbox_revision_unique UNIQUE (load_id, owner_revision)
);

CREATE INDEX load_outbox_pending
  ON load_outbox (created_at, message_id)
  WHERE state = 'pending';

CREATE FUNCTION prevent_load_revision_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.construction_state <> 'BUILDING' THEN
      RAISE EXCEPTION 'Load revisions must be created in BUILDING state';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Committed Load revisions cannot be deleted';
  END IF;
  IF OLD.construction_state <> 'BUILDING'
     OR NEW.construction_state <> 'COMMITTED'
     OR (to_jsonb(NEW) - 'construction_state') <> (to_jsonb(OLD) - 'construction_state') THEN
    RAISE EXCEPTION 'Load revisions are immutable after construction';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER load_revisions_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON load_revisions
  FOR EACH ROW EXECUTE FUNCTION prevent_load_revision_mutation();

CREATE FUNCTION prevent_load_revision_child_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  revision_state text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Load revision children are immutable';
  END IF;
  SELECT construction_state INTO revision_state
  FROM load_revisions
  WHERE revision_id = NEW.revision_id;
  IF revision_state IS DISTINCT FROM 'BUILDING' THEN
    RAISE EXCEPTION 'Load revision children can only be inserted while BUILDING';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER load_revision_stops_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON load_revision_stops
  FOR EACH ROW EXECUTE FUNCTION prevent_load_revision_child_mutation();
CREATE TRIGGER load_revision_freight_lines_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON load_revision_freight_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_load_revision_child_mutation();
CREATE TRIGGER load_revision_special_handling_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON load_revision_special_handling_codes
  FOR EACH ROW EXECUTE FUNCTION prevent_load_revision_child_mutation();

CREATE FUNCTION validate_committed_load_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  revision_state text;
  stop_count bigint;
  first_stop text;
  last_stop text;
  freight_count bigint;
  minimum_stop_sequence integer;
  maximum_stop_sequence integer;
  minimum_freight_sequence integer;
  maximum_freight_sequence integer;
BEGIN
  SELECT construction_state INTO revision_state
  FROM load_revisions
  WHERE revision_id = NEW.revision_id;
  IF revision_state IS DISTINCT FROM 'COMMITTED' THEN
    RAISE EXCEPTION 'A Load revision must be COMMITTED before transaction commit';
  END IF;

  SELECT count(*), min(sequence_number), max(sequence_number)
  INTO stop_count, minimum_stop_sequence, maximum_stop_sequence
  FROM load_revision_stops
  WHERE revision_id = NEW.revision_id;
  SELECT stop_type INTO first_stop
  FROM load_revision_stops
  WHERE revision_id = NEW.revision_id
  ORDER BY sequence_number
  LIMIT 1;
  SELECT stop_type INTO last_stop
  FROM load_revision_stops
  WHERE revision_id = NEW.revision_id
  ORDER BY sequence_number DESC
  LIMIT 1;
  IF stop_count < 2 OR minimum_stop_sequence <> 1
     OR maximum_stop_sequence <> stop_count
     OR first_stop <> 'PICKUP' OR last_stop <> 'DELIVERY' THEN
    RAISE EXCEPTION 'A committed booking revision requires contiguous pickup-to-delivery stops';
  END IF;

  SELECT count(*), min(sequence_number), max(sequence_number)
  INTO freight_count, minimum_freight_sequence, maximum_freight_sequence
  FROM load_revision_freight_lines
  WHERE revision_id = NEW.revision_id;
  IF freight_count < 1 OR minimum_freight_sequence <> 1
     OR maximum_freight_sequence <> freight_count THEN
    RAISE EXCEPTION 'A committed booking revision requires contiguous freight lines';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER load_revision_commit_validation
  AFTER INSERT OR UPDATE ON load_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION validate_committed_load_revision();

CREATE FUNCTION prevent_load_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Load lifecycle history is append-only';
END;
$$;

CREATE TRIGGER load_lifecycle_transitions_immutable
  BEFORE UPDATE OR DELETE ON load_lifecycle_transitions
  FOR EACH ROW EXECUTE FUNCTION prevent_load_history_mutation();
