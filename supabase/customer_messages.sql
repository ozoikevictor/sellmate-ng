create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  store_slug text not null,
  product_id uuid not null,
  product_name text not null,
  customer_name text not null,
  customer_phone text not null,
  message text not null,
  seller_reply text,
  replied_at timestamptz,
  status text not null default 'New' check (status in ('New', 'Read', 'Replied')),
  created_at timestamptz not null default now()
);

alter table public.customer_messages
  add column if not exists seller_reply text;

alter table public.customer_messages
  add column if not exists replied_at timestamptz;

create index if not exists customer_messages_seller_created_idx
  on public.customer_messages (seller_id, created_at desc);

create index if not exists customer_messages_store_slug_idx
  on public.customer_messages (store_slug);
