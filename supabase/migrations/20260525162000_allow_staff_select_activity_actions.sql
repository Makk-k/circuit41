do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'activity'
      and policyname = 'Staff can view all activity'
  ) then
    create policy "Staff can view all activity"
      on public.activity
      for select
      using (
        exists (
          select 1
          from public.staff_users
          where staff_users.id = auth.uid()
            and staff_users.active = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'actions'
      and policyname = 'Staff can view all actions'
  ) then
    create policy "Staff can view all actions"
      on public.actions
      for select
      using (
        exists (
          select 1
          from public.staff_users
          where staff_users.id = auth.uid()
            and staff_users.active = true
        )
      );
  end if;
end $$;
