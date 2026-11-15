\getenv runtime_password ECONOMICS_RUNTIME_DB_PASSWORD
CREATE ROLE economics_runtime LOGIN PASSWORD :'runtime_password';
GRANT CONNECT ON DATABASE operational_economics TO economics_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO economics_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE economics_migrator IN SCHEMA public
  GRANT SELECT, INSERT ON TABLES TO economics_runtime;
