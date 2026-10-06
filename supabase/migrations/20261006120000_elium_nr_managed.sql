-- Кабинет «ИП Айзада» (Elium) пересоздан 5 октября, и флаг nr_managed у него остался false.
-- Все командные функции (автоответы на отзывы, отчёты, РНП-утро, заказы, штрафы, РК)
-- берут только nr_managed = true, поэтому Elium для них не существовал.
-- Миграция nr_managed раньше ставила флаг один раз при создании колонки.
-- Выполняется от сервисной роли (auth.uid() is null), триггер cabinets_guard_nr_managed это пропускает.
update public.cabinets
   set nr_managed = true
 where id = '7efa5043-1bdd-41c3-bb5a-a2807ed83f5c'
   and nr_managed is distinct from true;
