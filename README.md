# Community Wishes (Leicester) – website + charity competitions

Live preview: https://jamescdrw.github.io/community-wishes-leicester/

## Pages
| Page | What it is |
|---|---|
| `index.html` | Main charity site (loads `parts/` + the competition showcase from `comp/front.js`) |
| `competitions.html` | All competitions, and each competition's entry page (`?id=…`) |
| `terms.html` | Competition terms, including the **free postal entry route** |
| `admin.html` | Admin (own logins: owner, admins, volunteers via invite code): competitions, entries & payments, draws, instant wins, accounts, Xero export, settings |
| `draw.html?id=…` | Full-screen **live draw** screen (for Facebook Live) – admin only |

## How it works (demo mode)
- **No server yet.** Entries, payments, accounts and the admin passcode are saved in the browser
  being used (localStorage). Use **Admin → Settings → Download full backup** regularly.
- **Publishing competitions:** Admin → Settings → *Download competitions.json*, then upload it to
  `comp/` in this repo. Every visitor then sees those competitions. (Entries and accounts are never in that file.)
- **Payments:** no online card payments yet. Entrants get a reference and bank details. The admin
  presses **Paid** when money arrives, and it goes into the accounts automatically.
- **Prize competition law:** each competition has a skill question and a free postal entry route
  (see `terms.html`). The trustees should review the terms before taking real entries.

## Before going live for real
1. Admin → Settings: real bank details, postal address, and switch **Preview mode** off.
2. Replace `DONATION_URL` in `parts/p8.txt` (Donate buttons).
3. Move to a real backend (e.g. Supabase) and online payments (e.g. Stripe), so entries from all
   visitors reach the admin, and the secret instant-win numbers stay off the public website.
