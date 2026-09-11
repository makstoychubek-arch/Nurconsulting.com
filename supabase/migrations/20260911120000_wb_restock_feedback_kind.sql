-- kind: question (вопросы WB) или feedback (отзыв). Реплай «через неделю» отвечает и то и то.

alter table public.wb_restock_questions
    add column if not exists kind text not null default 'question';

alter table public.wb_restock_questions
    drop constraint if exists wb_restock_questions_kind_check;

alter table public.wb_restock_questions
    add constraint wb_restock_questions_kind_check
    check (kind in ('question', 'feedback'));
