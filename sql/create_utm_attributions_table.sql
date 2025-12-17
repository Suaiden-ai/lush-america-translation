-- Cria tabela dedicada para armazenar atribuições de marketing
create table if not exists public.utm_attributions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  landing_page text,
  last_touch_page text,
  referrer text,
  captured_at timestamptz default timezone('utc', now()),
  created_at timestamptz default timezone('utc', now())
);

create index if not exists utm_attributions_user_id_idx on public.utm_attributions (user_id);
create index if not exists utm_attributions_email_idx on public.utm_attributions (lower(email));

