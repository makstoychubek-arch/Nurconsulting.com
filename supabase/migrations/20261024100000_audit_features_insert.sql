-- Журнал: первое выключение функции кабинета создаёт строку (insert), раньше оно не попадало в журнал,
-- а действие из функции cabinet-features шло от сервера без имени. Теперь пишем и вставку, и автора из updated_by.
create or replace function public.admin_audit_trigger() returns trigger language plpgsql security definer set search_path = public as $$
declare a text; t text; d text; uid uuid := auth.uid(); mail text;
begin
    begin
        if tg_table_name = 'cabinet_features' then uid := coalesce(uid, new.updated_by); end if;
        select email into mail from auth.users where id = uid;
        if tg_table_name = 'cabinet_viewers' then
            if tg_op = 'INSERT' then
                a := 'access_granted'; t := (select name from public.cabinets where id = new.cabinet_id); d := (select email from auth.users where id = new.user_id);
            else
                a := 'access_revoked'; t := (select name from public.cabinets where id = old.cabinet_id); d := (select email from auth.users where id = old.user_id);
            end if;
        elsif tg_table_name = 'team_staff' then
            if tg_op = 'INSERT' then a := 'staff_added'; d := new.email; else a := 'staff_removed'; d := old.email; end if;
        elsif tg_table_name = 'cabinets' then
            if tg_op = 'INSERT' then a := 'cabinet_added'; t := new.name;
            elsif tg_op = 'DELETE' then a := 'cabinet_deleted'; t := old.name;
            elsif new.wb_token is distinct from old.wb_token then a := 'wb_token_changed'; t := new.name;
            elsif new.adv_token_secret_id is distinct from old.adv_token_secret_id then a := 'adv_token_changed'; t := new.name;
            end if;
        elsif tg_table_name = 'cabinet_features' then
            if (tg_op = 'INSERT' and (new.enabled = false or new.paused_until is not null))
               or (tg_op = 'UPDATE' and (new.enabled is distinct from old.enabled or new.paused_until is distinct from old.paused_until)) then
                a := 'feature_toggled'; t := (select name from public.cabinets where id = new.cabinet_id);
                d := new.feature || ': ' || case when new.enabled = false then 'выключена' when new.paused_until is not null and new.paused_until > now() then 'пауза до ' || to_char(new.paused_until at time zone 'Asia/Bishkek', 'DD.MM HH24:MI') else 'включена' end;
            end if;
        end if;
        if a is not null then
            insert into public.admin_audit (actor, actor_email, action, target, detail) values (uid, coalesce(mail, 'система'), a, t, d);
        end if;
    exception when others then
        raise warning 'admin_audit_trigger: %', sqlerrm;
    end;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end $$;

drop trigger if exists admin_audit_features on public.cabinet_features;
create trigger admin_audit_features after insert or update on public.cabinet_features for each row execute function public.admin_audit_trigger();
