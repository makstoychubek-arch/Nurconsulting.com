do $block$
declare cmd text;
begin
  select command into cmd from cron.job where jobname = 'advertising-sync-6h';
  execute cmd;
end $block$;
