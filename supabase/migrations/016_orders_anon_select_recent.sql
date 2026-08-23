-- Allow anonymous customers to read recent orders (for real-time status updates)
-- Run this ALONE in a new SQL Editor query (do not combine with other migrations)
do $mig$
begin
  execute 'drop policy if exists "orders_anon_select_recent" on orders';
  execute 'create policy "orders_anon_select_recent" on orders for select to anon using (created_at > now() - interval ''24 hours'')';
end;
$mig$;
