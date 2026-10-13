import { Fragment, type ReactNode } from "react";

import { LiveGrid } from "./Live.tsx";
import { toggleMuted, useMuted } from "./shared.tsx";

export function Landing() {
  return (
    <div className="overflow-x-clip">
      <TopBar />
      <Hero />
      <ModelCard />
      <Api />
    </div>
  );
}

function TopBar() {
  return (
    <header className="px-6 pt-6">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <a href="/" className="font-display text-2xl font-bold tracking-tighter">
          Hev
        </a>
        <div className="flex items-center gap-4">
          <MuteButton />
          <a
            href="https://github.com/luisrudge/hev"
            aria-label="Hev on GitHub"
            className="text-ink/60 hover:text-ink"
          >
            <svg viewBox="0 0 16 16" className="size-6" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </nav>
    </header>
  );
}

function MuteButton() {
  const muted = useMuted();
  return (
    <button
      onClick={toggleMuted}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Unmute sounds" : "Mute sounds"}
      className="text-ink/60 hover:text-ink"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        {muted ? (
          <path d="m22 9-6 6m0-6 6 6" />
        ) : (
          <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
        )}
      </svg>
    </button>
  );
}

function Hero() {
  return (
    <section className="px-6 pt-16 pb-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-12 gap-y-2">
          <h1 className="rise font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-none font-bold tracking-tighter">
            <span className="relative inline-block w-0 align-baseline">
              <span className="scribble font-marker text-brand absolute bottom-[2.5em] -left-[0.3em] text-[0.36em] font-normal tracking-normal whitespace-nowrap">
                (Human)
              </span>
            </span>
            Decisions API
          </h1>
          <p className="rise font-display text-ink/60 pb-1 text-xl font-medium tracking-tight [animation-delay:120ms] md:text-2xl">
            Jev-compatible API, answered by <span className="text-brand">humans</span>
          </p>
        </div>
        <div className="rise [animation-delay:200ms]">
          <LiveGrid />
        </div>
      </div>
    </section>
  );
}

const specs = [
  ["Parameters", "1 human"],
  ["GPUs", "In this economy?"],
  ["Context window", "Honestly, not much"],
  ["Latency", "Who knows"],
];

function ModelCard() {
  return (
    <section className="mx-auto grid max-w-6xl items-center px-6 pt-12 pb-12 lg:grid-cols-2 lg:gap-12">
      <SectionHead
        className="lg:mb-0"
        id="model"
        kicker="Model card"
        title={
          <>
            Meet <em className="text-brand not-italic">Hev.</em>
          </>
        }
      >
        A human decision model. Same API as Jev and Clef, different hardware.
      </SectionHead>
      <dl className="border-line w-full max-w-2xl overflow-hidden rounded-2xl border bg-white">
        {specs.map(([k, v]) => (
          <div
            key={k}
            className="border-line flex items-baseline justify-between gap-6 border-b px-5 py-3.5 last:border-0"
          >
            <dt className="text-muted text-sm">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type SectionHeadProps = {
  className?: string;
  id: string;
  kicker: string;
  title: ReactNode;
  children?: ReactNode;
};

function SectionHead({ className = "", id, kicker, title, children }: SectionHeadProps) {
  return (
    <div id={id} className={`mb-14 max-w-2xl scroll-mt-24 ${className}`}>
      <p className="text-brand mb-3 font-mono text-xs tracking-widest uppercase">{kicker}</p>
      <h2 className="font-display text-4xl leading-[0.95] font-bold tracking-tighter md:text-5xl">
        {title}
      </h2>
      {children && <p className="text-ink/60 mt-5 text-lg">{children}</p>}
    </div>
  );
}

const curlCode = `curl https://usehev.com/v1/systemone \\
  -X POST \\
  -d '{
    "model": "hev",
    "state": "Checkout has been failing for every customer for the last hour.",
    "questions": {
      "urgent": { "type": "noul", "instructions": "Is this support request urgent?" },
      "team": {
        "type": "choice",
        "instructions": "Which team should handle this request?",
        "criteria": {
          "billing": "Payments, invoices, and refunds",
          "technical": "Outages, errors, and configuration",
          "sales": "Plans and upgrades"
        }
      }
    }
  }'`;

const responseCode = `{
  "id": "hev_3f9a1c2e",
  "model": "hev",
  "answers": {
    "urgent": { "type": "noul", "noul": 1 },
    "team": {
      "type": "choice",
      "choice": "technical",
      "probabilities": { "billing": 0, "technical": 1, "sales": 0 },
      "confidence": 1
    }
  },
  "latency_ms": 38214,
  "usage": {
    "input_tokens": 98,
    "output_tokens": 0,
    "human_seconds": 38.2,
    "gpus": 0,
    "sandwiches": 0.010615
  }
}`;

function Api() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-12 pb-24">
      <SectionHead
        id="api"
        kicker="API"
        title={
          <>
            Migrate from <em className="text-brand not-italic">Jev or Clef.</em>
          </>
        }
      >
        Keep your code and enjoy <strong className="text-ink">200x</strong> more latency!
      </SectionHead>
      <div className="mb-5 grid gap-3">
        <Diff from="Jev" before="https://api.typesafe.ai/v1/systemone" />
        <Diff
          from="Clef"
          before="https://api.cloudflare.com/client/v4/accounts/$ID/ai/run/@cf/cloudflare/clef"
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Code title="request.sh">{curlCode}</Code>
        <Code title="response.json">{responseCode}</Code>
      </div>
    </section>
  );
}

type DiffProps = { from: string; before: string };

// Long URLs wrap after a slash, never mid-word.
const breakable = (url: string) =>
  url.split("/").map((part, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <>
          /<wbr />
        </>
      )}
      {part}
    </Fragment>
  ));

function Diff({ from, before }: DiffProps) {
  return (
    <div className="border-line overflow-hidden rounded-2xl border bg-white font-mono text-sm">
      <div className="border-line text-muted border-b px-5 py-2 text-xs">{from}</div>
      <div className="bg-red-500/10 px-5 py-2.5 break-words text-red-700">
        - {breakable(before)}
      </div>
      <div className="bg-emerald-500/10 px-5 py-2.5 break-words text-emerald-700">
        + {breakable("https://usehev.com/v1/systemone")}
      </div>
    </div>
  );
}

type CodeProps = { title: string; children: string };

function Code({ title, children }: CodeProps) {
  return (
    <div className="border-line overflow-hidden rounded-2xl border bg-white">
      <div className="border-line flex items-center gap-2 border-b px-4 py-3">
        <span className="bg-ink/15 size-2.5 rounded-full" />
        <span className="bg-ink/15 size-2.5 rounded-full" />
        <span className="bg-ink/15 size-2.5 rounded-full" />
        <span className="text-muted ml-2 font-mono text-xs">{title}</span>
      </div>
      <pre className="text-ink/80 overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}
