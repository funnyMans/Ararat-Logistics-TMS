\getenv runtime_password CAPACITY_RUNTIME_DB_PASSWORD
CREATE ROLE capacity_runtime LOGIN PASSWORD :'runtime_password';
GRANT CONNECT ON DATABASE capacity_commitment TO capacity_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO capacity_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE capacity_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO capacity_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE capacity_migrator IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO capacity_runtime;
