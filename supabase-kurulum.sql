create table vehicle_card (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  phone_number text not null,
  created_at timestamp with time zone default now()
);

insert into vehicle_card (slug, phone_number)
values ('arac', '+905000000000');
