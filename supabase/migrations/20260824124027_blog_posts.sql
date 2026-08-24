create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_ar text not null,
  title_en text not null,
  excerpt_ar text not null,
  excerpt_en text not null,
  body_ar text not null,
  body_en text not null,
  published_at timestamptz not null default now()
);

alter table blog_posts enable row level security;

create policy "Published posts are publicly readable"
  on blog_posts for select
  using (published_at <= now());
