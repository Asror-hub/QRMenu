-- Ensure restaurant setting changes (e.g. auto_accept) stream in realtime.
do $$
begin
  begin
    alter publication supabase_realtime add table restaurants;
  exception
    when duplicate_object then
      null;
  end;
end $$;
