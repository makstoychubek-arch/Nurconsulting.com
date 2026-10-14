-- Тип публикации Instagram: пост/карусель (feed) или сторис (каждый слайд — отдельная сторис).
alter table public.content_posts add column if not exists post_kind text not null default 'feed' check (post_kind in ('feed', 'story'));
