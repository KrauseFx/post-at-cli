# post-at-cli

Unofficial CLI for viewing deliveries on post.at. Uses the same web flows as the site and requires your own account credentials.

## Features
- Login (short‑lived session caching)
- List deliveries (upcoming by default)
- Delivery details (expected date, sender, tracking number, picture URL when available)
- Set delivery place redirection (Wunschplatz)

## Install
```bash
npm install
npm run build
```

## Usage
```bash
export POST_AT_USERNAME="you@example.com"
export POST_AT_PASSWORD="your-password"

node dist/cli.js login
node dist/cli.js deliveries                           # all deliveries (default)
node dist/cli.js deliveries --status pending          # pending only
node dist/cli.js deliveries --status delivered        # delivered only
node dist/cli.js delivery <sendungsnummer>
node dist/cli.js routing place <sendungsnummer> --preset vor-der-wohnungstuer --description "If possible, please leave at the door"
```

### Sample output

Login
```text
Logged in as you@example.com
```

Deliveries
```text
Status: IV (In Verteilung) (in progress)
  1042348411302810212306  ETA: 2026-01-07 – 2026-01-08  from AMAZON
  1000265501074370110700  ETA: 2026-01-07 – 2026-01-08  from AllesPost

Status: ZU (Zugestellt) (delivered)
  1040906472585010212306  ETA: 2026-01-06T00:00:00  from AMAZON
```

Delivery details
```text
Tracking: 1042348411302810212306
Expected: 2026-01-07 – 2026-01-08
Sender: AMAZON
Status: IV
Picture: https://...
```


## Environment variables
- `POST_AT_USERNAME`: your post.at login email
- `POST_AT_PASSWORD`: your post.at password

## Delivery place options (Wunschplatz)
List the current options from post.at:

```bash
node dist/cli.js routing place-options
```

Known options (may change):
- `Vor_Haustüre` — Vor der Haustüre
- `Vor_Wohnungstüre` — Vor der Wohnungstüre
- `AufOderUnter_Briefkasten` — Unter / Auf dem Briefkasten
- `Hinter_Zaun` — Hinter dem Zaun
- `In_Garage` — In der Garage
- `Auf_Terrasse` — Auf der Terrasse
- `Im_Carport` — Im Carport
- `In_Flexbox` — In der Flexbox
- `sonstige` — Anderer Wunsch‑Platz

You can use a key directly:
```bash
node dist/cli.js routing place <sendungsnummer> --key Vor_Wohnungstüre --description "Bitte vor die Wohnungstür"
```

## Disclaimer / Non‑Affiliation
This project is **not affiliated with, endorsed by, or sponsored by** Österreichische Post AG or post.at in any way.

Use is **at your own risk**. The software is provided **“as is”**, without warranty of any kind, express or implied. The authors and contributors **are not responsible for any damages, losses, or legal issues** arising from its use.

Only use this tool with your **own** account and in compliance with post.at’s terms of service and applicable laws.
