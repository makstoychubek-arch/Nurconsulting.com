-- Один блогер может заказать две разные модели по очереди: заявка теперь на клиента и модель.
-- Старые заявки остаются с model_key = '' и работают как раньше.
alter table public.alina_selfbuy_leads add column if not exists model_key text not null default '';
drop index if exists public.alina_selfbuy_leads_user_chat_uidx;
create unique index if not exists alina_selfbuy_leads_user_chat_model_uidx
    on public.alina_selfbuy_leads (telegram_user_id, chat_id, model_key);
