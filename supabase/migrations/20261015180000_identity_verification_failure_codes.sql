-- Store only coarse outcome codes for identity verification attempts.
-- Never persist source images, OCR text, QR payloads, DOBs, face embeddings, or similarity values.
alter table public.identity_free_verification_attempts
  add column if not exists failure_code text;

alter table public.identity_free_verification_attempts
  drop constraint if exists identity_free_verification_attempts_failure_code_check;

alter table public.identity_free_verification_attempts
  add constraint identity_free_verification_attempts_failure_code_check
  check (
    failure_code is null or failure_code in (
      'payload_invalid',
      'document_qr_unreadable',
      'birth_date_unreadable',
      'face_count_invalid',
      'face_quality_low',
      'face_match_failed',
      'selfie_liveness_uncertain',
      'liveness_sequence_invalid',
      'document_data_mismatch',
      'verification_failed'
    )
  );

grant update on table public.identity_free_verification_attempts to service_role;
