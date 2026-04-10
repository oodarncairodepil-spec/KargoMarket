alter table public.km_inquiries
  add column if not exists payment_confirmation_image_url text,
  add column if not exists payment_confirmed_at timestamptz;
