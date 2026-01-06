# post-at-cli

Unofficial CLI for viewing deliveries on post.at. Uses the same web flows as the site (Azure AD B2C + GraphQL) and requires your own account credentials.

## Features
- Login (short‑lived session caching)
- List deliveries (upcoming by default)
- Delivery details (expected date, sender, tracking number, picture URL when available)

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
node dist/cli.js deliveries
node dist/cli.js deliveries --all
node dist/cli.js delivery <sendungsnummer>
```

## Environment variables
- `POST_AT_USERNAME`: your post.at login email
- `POST_AT_PASSWORD`: your post.at password

## Disclaimer / Non‑Affiliation
This project is **not affiliated with, endorsed by, or sponsored by** Österreichische Post AG or post.at in any way.

Use is **at your own risk**. The software is provided **“as is”**, without warranty of any kind, express or implied. The authors and contributors **are not responsible for any damages, losses, or legal issues** arising from its use.

Only use this tool with your **own** account and in compliance with post.at’s terms of service and applicable laws.
