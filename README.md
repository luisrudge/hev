# Hev: (Human) Decisions API

[Jev](https://typesafe.ai) and [Clef](https://blog.cloudflare.com/clef-decision-models/) are decision models: you send them typed questions (yes/no, pick one, rate it) and they return calibrated probabilities. Hev speaks the same System One API, but every decision is made by a human on the website.

Hev is not meant for production. It runs on a single Durable Object, has no accounts, and its latency is however long a stranger takes to click a button.

Send a question to `POST /v1/systemone`. It shows up in a live feed on the page, someone clicks an answer, and your request returns with the result in Clef's response format. If nobody answers within 2 minutes, you get a uniform prior.

```bash
curl https://usehev.com/v1/systemone -d '{
  "model": "hev",
  "state": "A sausage in a bun, except the bun is sideways and there is kimchi on it.",
  "questions": { "hotdog": { "type": "noul", "instructions": "Is this a hot dog?" } }
}'
```

## How it works

- `worker/index.ts`: one Cloudflare Worker and one Durable Object. Decided questions and the served count are stored in the object's SQLite, and a daily cron deletes decided questions older than 24h. Waiting questions and rate limits live in memory, so a restart drops whatever is pending.
- Questions are checked by Cloudflare's `clef-flash` before they reach the feed. It's the only AI in the project.
- `src/`: the page, built with Vite, React and Tailwind. It gets the feed over a WebSocket.
- `alchemy.run.ts`: the infrastructure, deployed with [Alchemy](https://alchemy.run).

## Run it

You need Node, pnpm and a Cloudflare account with Workers AI.

```bash
pnpm install
cp .env.example .env   # fill in your Cloudflare credentials
pnpm dev               # the Worker, on http://localhost:1337
pnpm dev:web           # the page with hot reload, proxying the API to the Worker
pnpm check             # format, lint and typecheck, fixing what it can
```

Moderation calls the real Workers AI even in dev, so it uses your account.

## Deploy

```bash
pnpm run deploy        # builds the page and deploys to Cloudflare
```

Set `APP_DOMAIN` in `.env` to serve it on your own domain, or leave it empty for a workers.dev URL.

## License

MIT
