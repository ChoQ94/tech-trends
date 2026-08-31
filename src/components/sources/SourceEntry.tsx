import Link from "next/link";
import { Callout, Card } from "@/components/ui";
import {
  CredibilityBadge,
  FETCH_KIND_EXPLAINER,
  FetchKindBadge,
} from "@/components/sources/badges";
import { DASH } from "@/lib/format";
import type { LeaderboardSource } from "@/lib/types";

/** One label/value row. Stacks on narrow screens, aligns on wide ones. */
export function Field({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-0.5 py-1.5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">
        {label}
      </dt>
      <dd
        className={`min-w-0 break-words text-xs leading-5 text-fg-muted ${
          mono ? "font-mono" : ""
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

export function SourceEntry({ source }: { source: LeaderboardSource }) {
  return (
    <Card id={source.id} className="scroll-mt-20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-fg">
            {source.name}
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">
            {source.measures}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FetchKindBadge kind={source.fetchKind} />
          <CredibilityBadge credibility={source.credibility} />
        </div>
      </div>

      <dl className="mt-3 divide-y divide-border border-t border-border">
        <Field label="Page">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-accent hover:underline"
          >
            {source.url}
          </a>
        </Field>
        <Field label="Endpoint we call" mono>
          <span className="break-all text-fg">{source.endpoint}</span>
        </Field>
        <Field label="Method">
          <span className="font-mono text-fg">{source.method}</span>
        </Field>
        <Field label="Fetch kind">
          <span className="font-mono text-fg">{source.fetchKind}</span>
          <span className="text-fg-subtle">
            {" "}
            — {FETCH_KIND_EXPLAINER[source.fetchKind]}
          </span>
        </Field>
        <Field label="Auth">
          {source.requiresAuth ? (
            <span className="text-warn">
              Requires a key we do not ship, so this source cannot be fetched
              from a clean checkout.
            </span>
          ) : (
            "None. No key, no account."
          )}
        </Field>
        <Field label="Licence">
          {source.license ?? (
            <span className="text-fg-subtle">
              {DASH} not stated by the operator
            </span>
          )}
        </Field>
        <Field label="Cadence">{source.cadence}</Field>
        <Field label="Unit">
          <span className="font-mono text-fg">{source.unit}</span>
        </Field>
        <Field label="Credibility">{source.credibilityNote}</Field>
      </dl>

      {source.conflictOfInterest ? (
        <div className="mt-3">
          <Callout label="Conflict of interest" tone="warn">
            {source.conflictOfInterest}
          </Callout>
        </div>
      ) : null}

      <p className="mt-3 text-[11px]">
        <Link
          href={`/leaderboards?source=${encodeURIComponent(source.id)}`}
          className="text-accent hover:underline"
        >
          See this source&rsquo;s boards →
        </Link>
      </p>
    </Card>
  );
}
