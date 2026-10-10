<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Account type (patient/provider) lives on `profiles.account_type`, set once at signup by trigger; provider access to patient data is granted only through `log_shares` rows. Why: roles never come from editable data.
- Session is client-side (AuthProvider in `src/lib/auth.tsx`); protected pages sit under `_authenticated` and query via the browser client with RLS. Why: no SSR session available.
