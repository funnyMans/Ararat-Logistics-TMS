CREATE TABLE economic_estimate_records (
  estimate_id uuid PRIMARY KEY,
  scope_type text NOT NULL CHECK (scope_type IN ('load', 'candidate')),
  load_id uuid NOT NULL,
  load_revision text NOT NULL CHECK (length(load_revision) BETWEEN 1 AND 128),
  trio_id uuid,
  trio_revision text CHECK (
    trio_revision IS NULL OR length(trio_revision) BETWEEN 1 AND 128
  ),
  contract_version text NOT NULL CHECK (contract_version = '1.0.0'),
  model_version text NOT NULL CHECK (length(model_version) BETWEEN 1 AND 100),
  input_schema_version text NOT NULL CHECK (length(input_schema_version) BETWEEN 1 AND 100),
  result_schema_version text NOT NULL CHECK (length(result_schema_version) BETWEEN 1 AND 100),
  input_snapshot jsonb NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
  result_snapshot jsonb NOT NULL CHECK (jsonb_typeof(result_snapshot) = 'object'),
  provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'array'),
  generated_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  record_hash bytea NOT NULL CHECK (octet_length(record_hash) = 32),
  CONSTRAINT economic_estimate_scope_identity CHECK (
    (scope_type = 'load' AND trio_id IS NULL AND trio_revision IS NULL)
    OR
    (scope_type = 'candidate' AND trio_id IS NOT NULL AND trio_revision IS NOT NULL)
  )
);

CREATE INDEX economic_estimate_records_by_load
  ON economic_estimate_records (load_id, recorded_at DESC, estimate_id DESC);

CREATE INDEX economic_estimate_records_by_load_trio
  ON economic_estimate_records (load_id, trio_id, recorded_at DESC, estimate_id DESC)
  WHERE trio_id IS NOT NULL;
