import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

import type { Hev } from "./worker/index.ts";

export const Api = Cloudflare.Worker("Api", {
  main: "./worker/index.ts",
  domain: Config.String("APP_DOMAIN").pipe(Config.withDefault(undefined)),
  assets: {
    directory: "./dist",
    notFoundHandling: "single-page-application",
    runWorkerFirst: ["/v1/*", "/api/*"],
  },
  crons: ["0 4 * * *"], // daily cleanup of decided questions older than 24h
  // Replaces Alchemy's default (logs only), so logs are listed again next to traces.
  observability: {
    enabled: true,
    logs: { enabled: true, invocationLogs: true },
    traces: { enabled: true, headSamplingRate: 1 },
  },
  dev: { port: Number(process.env.PORT) || undefined, strictPort: true },
  env: {
    HEV: Cloudflare.DurableObject<Hev>("Hev"),
    AI: Cloudflare.Workers.AI(),
  },
});

export type Env = Cloudflare.InferEnv<typeof Api>;

export default Alchemy.Stack(
  "Hev",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const api = yield* Api;
    return { url: api.url.as<string>() };
  }),
);
