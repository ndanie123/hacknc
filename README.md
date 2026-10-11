# hacknc
Project Log Companion HackNC 2026 Repository
Team Yoshi: Devanshi, Lilian, Yashvi, Nick D.

## Synthetic dashboard data

Use `npm run seed:synthetic` to preview a local seed plan (25 patients, 5
providers, and 4 logs per patient by default). This script targets this app's
Supabase `profiles`, `health_logs`, and `log_shares` tables; the separate
`generate_synthetic_data (2).py` script targets a different medication schema.

To create synthetic Auth users, add a Supabase **service-role** key to the
git-ignored `.env.local` file:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Never put that key in browser code, commit it, or share it in chat. Then apply
the default dataset with:

```sh
npm run seed:synthetic -- --apply
```

You can change the volume, for example:

```sh
npm run seed:synthetic -- --patients 100 --providers 10 --logs-per-patient 5 --apply
```

The script creates confirmed test accounts with a one-time generated password,
prints the synthetic provider sign-in emails and password, and shares generated
logs across those providers. It refuses to add a duplicate seed. To remove only
the users and logs created by this seeder, run:

```sh
npm run seed:synthetic -- --cleanup --apply
```

Cleanup stops without deleting accounts if it finds untagged health logs owned
by seeded accounts. Keep synthetic data in a development/test Supabase project,
not production.

To inspect the database, open the [Supabase project dashboard](https://supabase.com/dashboard/project/usmzvhhksrcqfptwlzju/editor)
and choose **Table Editor** to view `profiles`, `health_logs`, and `log_shares`.
Use **SQL Editor** for aggregate queries, for example:

```sql
select
  (select count(*) from public.profiles where account_type = 'patient') as patients,
  (select count(*) from public.profiles where account_type = 'provider') as providers,
  (select count(*) from public.health_logs) as logs,
  (select count(*) from public.log_shares) as shares;
```

Auth accounts are visible under **Authentication → Users**. In the provider
dashboard, sign in as one of the generated provider accounts; each provider
sees only the health logs shared with that account.

# Log-ins
Patient — email: maya@aerohealth.app 
Password: Patient!2026 
Provider — email: dr.chen@aerohealth.app 
password: Provider!2026
