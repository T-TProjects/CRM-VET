# CRM-VET — working instructions

This is a live veterinary CRM (Next.js + Supabase) deployed automatically by Vercel.
The person using this is a **non-technical user** who will describe changes in plain language.

## Golden rule: auto-commit and push every change

After you make ANY edit the user asks for, you must — without being asked and without
waiting for confirmation:

1. Stage everything: `git add -A`
2. Commit with a short, plain-English message describing what changed
   (e.g. `Change appointment button color to green`).
3. Push to main: `git push origin main`

Pushing to `main` triggers an automatic Vercel deployment, so the change goes live on the
website within a minute or two. After pushing, tell the user in plain language that the
change is live and roughly when it will appear.

If a push is ever rejected because the remote moved ahead, run `git pull --rebase origin main`
and then push again.

## Talk like a human, not an engineer

The user is not a programmer. Explain what you did and what will happen in everyday language.
Avoid jargon. If a request is ambiguous, ask one simple question before changing anything.

## Safety

- This is a production system with real data. Make the smallest change that satisfies the request.
- NEVER edit, print, or commit secrets. `.env` files are git-ignored — keep it that way.
- Do not run database migrations, delete data, or change Supabase/auth config unless the user
  explicitly asks for that specific thing.
- If a change looks risky or destructive (deleting features, bulk edits, schema changes),
  briefly explain the risk and ask for a yes before doing it.
- Never use `git push --force` or rewrite history.

## Project facts

- Framework: Next.js (App Router) in `app/`, components in `components/`, helpers in `lib/`.
- Styling: Tailwind CSS.
- Backend/data: Supabase (`supabase/`).
- Default + deploy branch: `main`. There is no separate staging branch.
