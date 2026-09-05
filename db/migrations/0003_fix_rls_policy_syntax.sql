-- The original policies compared `auth.user_id() = owner_id` directly.
-- Neon's own documented pattern wraps the call in a scalar subquery
-- `(select auth.user_id())`; without it, this Neon-specific C-extension
-- function (pg_session_jwt) silently failed to resolve the session's user
-- id under RLS, making every row invisible (SELECT) and every insert/update
-- rejected (42501) via the Data API, even though the JWT and owner_id
-- matched. Discovered while investigating why a bulk-imported collection
-- wasn't showing up in the app despite being present in the table.

drop policy if exists albums_owner_select on albums;
create policy albums_owner_select on albums for select
  using ((select auth.user_id()) = owner_id);

drop policy if exists albums_owner_insert on albums;
create policy albums_owner_insert on albums for insert
  with check ((select auth.user_id()) = owner_id);

drop policy if exists albums_owner_update on albums;
create policy albums_owner_update on albums for update
  using ((select auth.user_id()) = owner_id)
  with check ((select auth.user_id()) = owner_id);

drop policy if exists albums_owner_delete on albums;
create policy albums_owner_delete on albums for delete
  using ((select auth.user_id()) = owner_id);
