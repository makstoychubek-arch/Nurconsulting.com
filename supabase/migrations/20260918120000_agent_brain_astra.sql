-- Модуль Astra на хабе агентов: ручной остаток баланса.
-- Не живой биллинг OpenAI — ключа org usage нет, тесты офлайн.

alter table public.agent_brain
    add column if not exists astra_balance numeric,
    add column if not exists astra_currency text not null default 'USD';

comment on column public.agent_brain.astra_balance is
    'Остаток в модуле Astra. Задаёт команда, с OpenAI не тянется.';
comment on column public.agent_brain.astra_currency is
    'Валюта остатка Astra: USD или RUB.';
