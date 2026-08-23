-- Enable Supabase Realtime for the orders table (required for POS Bridge automatic printing)
-- This adds orders to the supabase_realtime publication so postgres_changes events are sent
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end
$$;
