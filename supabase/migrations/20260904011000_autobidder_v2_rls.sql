-- Автобиддер v2: RLS из docs/autobidder.md §11.2.
-- Доступ только через user_cabinet_access (и супер-админ как owner).
-- viewer — только select;
-- ads_manager — select + insert/update на autobidder_rules и bid_history;
-- owner — всё.
-- bid_history и snapshots — через join на adv_campaigns.cabinet_id.

create or replace function public.adv_access_role(cid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_super_admin() then 'owner'
    else (
      select a.role
      from public.user_cabinet_access a
      where a.user_id = auth.uid()
        and a.cabinet_id = cid
      limit 1
    )
  end;
$$;

create or replace function public.adv_has_cabinet(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.adv_access_role(cid) is not null;
$$;

create or replace function public.adv_role_in(cid uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.adv_access_role(cid) = any (roles);
$$;

revoke all on function public.adv_access_role(uuid) from public;
revoke all on function public.adv_has_cabinet(uuid) from public;
revoke all on function public.adv_role_in(uuid, text[]) from public;
grant execute on function public.adv_access_role(uuid) to authenticated, service_role;
grant execute on function public.adv_has_cabinet(uuid) to authenticated, service_role;
grant execute on function public.adv_role_in(uuid, text[]) to authenticated, service_role;

-- ── user_cabinet_access ───────────────────────────────────────
alter table public.user_cabinet_access enable row level security;

drop policy if exists user_cabinet_access_select on public.user_cabinet_access;
create policy user_cabinet_access_select on public.user_cabinet_access
  for select to authenticated
  using (user_id = auth.uid() or public.adv_role_in(cabinet_id, array['owner']));

drop policy if exists user_cabinet_access_insert on public.user_cabinet_access;
create policy user_cabinet_access_insert on public.user_cabinet_access
  for insert to authenticated
  with check (
    public.adv_role_in(cabinet_id, array['owner'])
    or public.is_super_admin()
    or exists (
      select 1 from public.cabinets c
      where c.id = cabinet_id and c.user_id = auth.uid()
    )
  );

drop policy if exists user_cabinet_access_update on public.user_cabinet_access;
create policy user_cabinet_access_update on public.user_cabinet_access
  for update to authenticated
  using (public.adv_role_in(cabinet_id, array['owner']))
  with check (public.adv_role_in(cabinet_id, array['owner']));

drop policy if exists user_cabinet_access_delete on public.user_cabinet_access;
create policy user_cabinet_access_delete on public.user_cabinet_access
  for delete to authenticated
  using (public.adv_role_in(cabinet_id, array['owner']));

-- ── cabinet_groups ────────────────────────────────────────────
alter table public.cabinet_groups enable row level security;

drop policy if exists cabinet_groups_select on public.cabinet_groups;
create policy cabinet_groups_select on public.cabinet_groups
  for select to authenticated
  using (
    exists (
      select 1 from public.cabinets c
      where c.adv_group_id = cabinet_groups.id
        and public.adv_has_cabinet(c.id)
    )
  );

drop policy if exists cabinet_groups_insert on public.cabinet_groups;
create policy cabinet_groups_insert on public.cabinet_groups
  for insert to authenticated
  with check (
    exists (
      select 1 from public.user_cabinet_access a
      where a.user_id = auth.uid() and a.role = 'owner'
    )
    or public.is_super_admin()
  );

drop policy if exists cabinet_groups_update on public.cabinet_groups;
create policy cabinet_groups_update on public.cabinet_groups
  for update to authenticated
  using (
    exists (
      select 1 from public.cabinets c
      where c.adv_group_id = cabinet_groups.id
        and public.adv_role_in(c.id, array['owner'])
    )
  )
  with check (
    exists (
      select 1 from public.cabinets c
      where c.adv_group_id = cabinet_groups.id
        and public.adv_role_in(c.id, array['owner'])
    )
  );

drop policy if exists cabinet_groups_delete on public.cabinet_groups;
create policy cabinet_groups_delete on public.cabinet_groups
  for delete to authenticated
  using (
    exists (
      select 1 from public.cabinets c
      where c.adv_group_id = cabinet_groups.id
        and public.adv_role_in(c.id, array['owner'])
    )
  );

-- ── autobidder_templates (org_id, без cabinet_id) ─────────────
alter table public.autobidder_templates enable row level security;

drop policy if exists autobidder_templates_select on public.autobidder_templates;
create policy autobidder_templates_select on public.autobidder_templates
  for select to authenticated
  using (
    exists (
      select 1 from public.user_cabinet_access a
      where a.user_id = auth.uid()
    )
    or public.is_super_admin()
  );

drop policy if exists autobidder_templates_write on public.autobidder_templates;
create policy autobidder_templates_write on public.autobidder_templates
  for all to authenticated
  using (
    exists (
      select 1 from public.user_cabinet_access a
      where a.user_id = auth.uid() and a.role = 'owner'
    )
    or public.is_super_admin()
  )
  with check (
    exists (
      select 1 from public.user_cabinet_access a
      where a.user_id = auth.uid() and a.role = 'owner'
    )
    or public.is_super_admin()
  );

-- ── adv_campaigns ─────────────────────────────────────────────
alter table public.adv_campaigns enable row level security;

drop policy if exists adv_campaigns_select on public.adv_campaigns;
create policy adv_campaigns_select on public.adv_campaigns
  for select to authenticated
  using (public.adv_has_cabinet(cabinet_id));

drop policy if exists adv_campaigns_insert on public.adv_campaigns;
create policy adv_campaigns_insert on public.adv_campaigns
  for insert to authenticated
  with check (public.adv_role_in(cabinet_id, array['owner']));

drop policy if exists adv_campaigns_update on public.adv_campaigns;
create policy adv_campaigns_update on public.adv_campaigns
  for update to authenticated
  using (public.adv_role_in(cabinet_id, array['owner']))
  with check (public.adv_role_in(cabinet_id, array['owner']));

drop policy if exists adv_campaigns_delete on public.adv_campaigns;
create policy adv_campaigns_delete on public.adv_campaigns
  for delete to authenticated
  using (public.adv_role_in(cabinet_id, array['owner']));

-- ── adv_clusters (через adv_campaigns.cabinet_id) ─────────────
alter table public.adv_clusters enable row level security;

drop policy if exists adv_clusters_select on public.adv_clusters;
create policy adv_clusters_select on public.adv_clusters
  for select to authenticated
  using (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_has_cabinet(c.cabinet_id)
    )
  );

drop policy if exists adv_clusters_insert on public.adv_clusters;
create policy adv_clusters_insert on public.adv_clusters
  for insert to authenticated
  with check (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

drop policy if exists adv_clusters_update on public.adv_clusters;
create policy adv_clusters_update on public.adv_clusters
  for update to authenticated
  using (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  )
  with check (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

drop policy if exists adv_clusters_delete on public.adv_clusters;
create policy adv_clusters_delete on public.adv_clusters
  for delete to authenticated
  using (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

-- ── autobidder_rules + bid_history ────────────────────────────
-- v2: campaign_id uuid → adv_campaigns.
-- MVP (20260903200000): campaign_id bigint + cabinet_id — политики v2 не ставим,
-- чтобы не ломать типы и не трогать существующую таблицу.
do $$
declare
  camp_type text;
begin
  select c.data_type into camp_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'autobidder_rules'
    and c.column_name = 'campaign_id';

  if camp_type = 'uuid' then
    execute 'alter table public.autobidder_rules enable row level security';

    execute 'drop policy if exists autobidder_rules_select on public.autobidder_rules';
    execute $p$
      create policy autobidder_rules_select on public.autobidder_rules
        for select to authenticated
        using (
          exists (
            select 1 from public.adv_campaigns c
            where c.id = campaign_id and public.adv_has_cabinet(c.cabinet_id)
          )
        )
    $p$;

    execute 'drop policy if exists autobidder_rules_insert on public.autobidder_rules';
    execute $p$
      create policy autobidder_rules_insert on public.autobidder_rules
        for insert to authenticated
        with check (
          exists (
            select 1 from public.adv_campaigns c
            where c.id = campaign_id
              and public.adv_role_in(c.cabinet_id, array['ads_manager', 'owner'])
          )
        )
    $p$;

    execute 'drop policy if exists autobidder_rules_update on public.autobidder_rules';
    execute $p$
      create policy autobidder_rules_update on public.autobidder_rules
        for update to authenticated
        using (
          exists (
            select 1 from public.adv_campaigns c
            where c.id = campaign_id
              and public.adv_role_in(c.cabinet_id, array['ads_manager', 'owner'])
          )
        )
        with check (
          exists (
            select 1 from public.adv_campaigns c
            where c.id = campaign_id
              and public.adv_role_in(c.cabinet_id, array['ads_manager', 'owner'])
          )
        )
    $p$;

    execute 'drop policy if exists autobidder_rules_delete on public.autobidder_rules';
    execute $p$
      create policy autobidder_rules_delete on public.autobidder_rules
        for delete to authenticated
        using (
          exists (
            select 1 from public.adv_campaigns c
            where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
          )
        )
    $p$;

    execute 'alter table public.bid_history enable row level security';

    execute 'drop policy if exists bid_history_select on public.bid_history';
    execute $p$
      create policy bid_history_select on public.bid_history
        for select to authenticated
        using (
          exists (
            select 1
            from public.autobidder_rules r
            join public.adv_campaigns c on c.id = r.campaign_id
            where r.id = rule_id and public.adv_has_cabinet(c.cabinet_id)
          )
        )
    $p$;

    execute 'drop policy if exists bid_history_insert on public.bid_history';
    execute $p$
      create policy bid_history_insert on public.bid_history
        for insert to authenticated
        with check (
          exists (
            select 1
            from public.autobidder_rules r
            join public.adv_campaigns c on c.id = r.campaign_id
            where r.id = rule_id
              and public.adv_role_in(c.cabinet_id, array['ads_manager', 'owner'])
          )
        )
    $p$;

    execute 'drop policy if exists bid_history_update on public.bid_history';
    execute $p$
      create policy bid_history_update on public.bid_history
        for update to authenticated
        using (
          exists (
            select 1
            from public.autobidder_rules r
            join public.adv_campaigns c on c.id = r.campaign_id
            where r.id = rule_id
              and public.adv_role_in(c.cabinet_id, array['ads_manager', 'owner'])
          )
        )
        with check (
          exists (
            select 1
            from public.autobidder_rules r
            join public.adv_campaigns c on c.id = r.campaign_id
            where r.id = rule_id
              and public.adv_role_in(c.cabinet_id, array['ads_manager', 'owner'])
          )
        )
    $p$;

    execute 'drop policy if exists bid_history_delete on public.bid_history';
    execute $p$
      create policy bid_history_delete on public.bid_history
        for delete to authenticated
        using (
          exists (
            select 1
            from public.autobidder_rules r
            join public.adv_campaigns c on c.id = r.campaign_id
            where r.id = rule_id and public.adv_role_in(c.cabinet_id, array['owner'])
          )
        )
    $p$;
  else
    -- MVP-схема: bid_history новая, cabinet_id есть на правиле.
    execute 'alter table public.bid_history enable row level security';

    execute 'drop policy if exists bid_history_select on public.bid_history';
    execute $p$
      create policy bid_history_select on public.bid_history
        for select to authenticated
        using (
          exists (
            select 1 from public.autobidder_rules r
            where r.id = rule_id and public.adv_has_cabinet(r.cabinet_id)
          )
        )
    $p$;

    execute 'drop policy if exists bid_history_insert on public.bid_history';
    execute $p$
      create policy bid_history_insert on public.bid_history
        for insert to authenticated
        with check (
          exists (
            select 1 from public.autobidder_rules r
            where r.id = rule_id
              and public.adv_role_in(r.cabinet_id, array['ads_manager', 'owner'])
          )
        )
    $p$;

    execute 'drop policy if exists bid_history_update on public.bid_history';
    execute $p$
      create policy bid_history_update on public.bid_history
        for update to authenticated
        using (
          exists (
            select 1 from public.autobidder_rules r
            where r.id = rule_id
              and public.adv_role_in(r.cabinet_id, array['ads_manager', 'owner'])
          )
        )
        with check (
          exists (
            select 1 from public.autobidder_rules r
            where r.id = rule_id
              and public.adv_role_in(r.cabinet_id, array['ads_manager', 'owner'])
          )
        )
    $p$;

    execute 'drop policy if exists bid_history_delete on public.bid_history';
    execute $p$
      create policy bid_history_delete on public.bid_history
        for delete to authenticated
        using (
          exists (
            select 1 from public.autobidder_rules r
            where r.id = rule_id and public.adv_role_in(r.cabinet_id, array['owner'])
          )
        )
    $p$;
  end if;
end $$;

-- ── serp_position_snapshots: через adv_campaigns.cabinet_id ───
alter table public.serp_position_snapshots enable row level security;

drop policy if exists serp_position_snapshots_select on public.serp_position_snapshots;
create policy serp_position_snapshots_select on public.serp_position_snapshots
  for select to authenticated
  using (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_has_cabinet(c.cabinet_id)
    )
  );

drop policy if exists serp_position_snapshots_insert on public.serp_position_snapshots;
create policy serp_position_snapshots_insert on public.serp_position_snapshots
  for insert to authenticated
  with check (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

drop policy if exists serp_position_snapshots_update on public.serp_position_snapshots;
create policy serp_position_snapshots_update on public.serp_position_snapshots
  for update to authenticated
  using (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  )
  with check (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

drop policy if exists serp_position_snapshots_delete on public.serp_position_snapshots;
create policy serp_position_snapshots_delete on public.serp_position_snapshots
  for delete to authenticated
  using (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

-- ── auction_snapshots: нет campaign_id — через cluster_key → adv_clusters → adv_campaigns
alter table public.auction_snapshots enable row level security;

drop policy if exists auction_snapshots_select on public.auction_snapshots;
create policy auction_snapshots_select on public.auction_snapshots
  for select to authenticated
  using (
    exists (
      select 1
      from public.adv_clusters cl
      join public.adv_campaigns c on c.id = cl.campaign_id
      where cl.cluster_key = auction_snapshots.cluster_key
        and public.adv_has_cabinet(c.cabinet_id)
    )
  );

drop policy if exists auction_snapshots_insert on public.auction_snapshots;
create policy auction_snapshots_insert on public.auction_snapshots
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.adv_clusters cl
      join public.adv_campaigns c on c.id = cl.campaign_id
      where cl.cluster_key = auction_snapshots.cluster_key
        and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

drop policy if exists auction_snapshots_update on public.auction_snapshots;
create policy auction_snapshots_update on public.auction_snapshots
  for update to authenticated
  using (
    exists (
      select 1
      from public.adv_clusters cl
      join public.adv_campaigns c on c.id = cl.campaign_id
      where cl.cluster_key = auction_snapshots.cluster_key
        and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  )
  with check (
    exists (
      select 1
      from public.adv_clusters cl
      join public.adv_campaigns c on c.id = cl.campaign_id
      where cl.cluster_key = auction_snapshots.cluster_key
        and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

drop policy if exists auction_snapshots_delete on public.auction_snapshots;
create policy auction_snapshots_delete on public.auction_snapshots
  for delete to authenticated
  using (
    exists (
      select 1
      from public.adv_clusters cl
      join public.adv_campaigns c on c.id = cl.campaign_id
      where cl.cluster_key = auction_snapshots.cluster_key
        and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

-- ── adv_daily_stats ───────────────────────────────────────────
alter table public.adv_daily_stats enable row level security;

drop policy if exists adv_daily_stats_select on public.adv_daily_stats;
create policy adv_daily_stats_select on public.adv_daily_stats
  for select to authenticated
  using (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_has_cabinet(c.cabinet_id)
    )
  );

drop policy if exists adv_daily_stats_insert on public.adv_daily_stats;
create policy adv_daily_stats_insert on public.adv_daily_stats
  for insert to authenticated
  with check (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

drop policy if exists adv_daily_stats_update on public.adv_daily_stats;
create policy adv_daily_stats_update on public.adv_daily_stats
  for update to authenticated
  using (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  )
  with check (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

drop policy if exists adv_daily_stats_delete on public.adv_daily_stats;
create policy adv_daily_stats_delete on public.adv_daily_stats
  for delete to authenticated
  using (
    exists (
      select 1 from public.adv_campaigns c
      where c.id = campaign_id and public.adv_role_in(c.cabinet_id, array['owner'])
    )
  );

grant select, insert, update, delete on public.cabinet_groups to authenticated, service_role;
grant select, insert, update, delete on public.user_cabinet_access to authenticated, service_role;
grant select, insert, update, delete on public.adv_campaigns to authenticated, service_role;
grant select, insert, update, delete on public.adv_clusters to authenticated, service_role;
grant select, insert, update, delete on public.autobidder_templates to authenticated, service_role;
grant select, insert, update, delete on public.autobidder_rules to authenticated, service_role;
grant select, insert, update, delete on public.bid_history to authenticated, service_role;
grant select, insert, update, delete on public.serp_position_snapshots to authenticated, service_role;
grant select, insert, update, delete on public.auction_snapshots to authenticated, service_role;
grant select, insert, update, delete on public.adv_daily_stats to authenticated, service_role;
grant select on public.adv_daily_stats_v to authenticated, service_role;
grant usage, select on sequence public.bid_history_id_seq to authenticated, service_role;
grant usage, select on sequence public.serp_position_snapshots_id_seq to authenticated, service_role;
grant usage, select on sequence public.auction_snapshots_id_seq to authenticated, service_role;
