-- Payment proof + paid timestamp on km_inquiries (Express customer flow)
alter table public.km_inquiries add column if not exists payment_proof_file_name text;
alter table public.km_inquiries add column if not exists payment_proof_data_url text;
alter table public.km_inquiries add column if not exists paid_at timestamptz;
