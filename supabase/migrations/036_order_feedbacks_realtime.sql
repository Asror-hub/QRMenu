-- Enable realtime so admin/mobile can alert on new guest feedback.

do $pub$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_feedbacks'
  ) then
    alter publication supabase_realtime add table order_feedbacks;
  end if;
end;
$pub$;
