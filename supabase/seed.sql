-- ============================================================================
-- Seed — two development logins, and nothing else.
--
-- There is no demo data in this repo, on purpose. A dashboard that looks alive
-- because somebody typed the story into a seed file demonstrates nothing: every
-- row on every screen is created through the UI, by the person using it.
--
-- The people row is NOT written here. A trigger on auth.users creates it — see
-- handle_new_user() in the migration — which is what keeps this file free of
-- business data even for the users themselves. Everybody else is added from the
-- People screen inside the app.
--
-- Local only, and deliberately so: these are development logins with known
-- passwords. Never pass --include-seed at a hosted project; create that account
-- by hand instead — see setup.md.
-- ============================================================================

do $$
declare
  u record;
  uid uuid;
begin
  for u in
    select * from (values
      ('abhishek.parkk@example.com', 'abhi123',   'Abhishek', 'Abhi'),
      ('varsha.parkk@example.com',   'varsha123', 'Varsha',   'Varsha')
    ) as t(email, password, full_name, short_name)
  loop
    -- Idempotent: db reset drops everything, but running the seed twice by hand
    -- should not blow up.
    if exists (select 1 from auth.users where email = u.email) then
      continue;
    end if;

    uid := gen_random_uuid();

    -- The four token columns are nullable in the table and NOT nullable in
    -- GoTrue, which scans them into plain Go strings. Leave them null and every
    -- login fails with "Database error querying schema". They must be ''.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid,
      'authenticated',
      'authenticated',
      u.email,
      crypt(u.password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', u.full_name, 'short_name', u.short_name),
      '', '', '', '',
      now(),
      now()
    );

    -- Without a matching identity row GoTrue accepts the password and then
    -- refuses the login. It is not optional.
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      uid,
      uid::text,
      'email',
      jsonb_build_object('sub', uid::text, 'email', u.email, 'email_verified', true),
      now(), now(), now()
    );
  end loop;
end $$;
