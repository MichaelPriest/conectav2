-- Explicit write permissions for the server-authoritative Conecta ID verdict.
-- Raw identity images, OCR text, exact date of birth and biometrics are not stored.
grant select, insert, update on table public.age_assurance_decisions to service_role;
grant select, insert, update on table public.identity_verifications to service_role;
