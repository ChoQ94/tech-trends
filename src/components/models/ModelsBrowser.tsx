"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ModelsSection,
  resolveModelFilters,
} from "@/components/models/ModelsSection";
import type { Model } from "@/lib/types";

/**
 * The filtered half of /models, moved into the browser.
 *
 * The page used to `await searchParams`, which is a request-time API: reading
 * it opted the whole route into rendering once per visitor, and on a Hobby
 * plan the bill for that is Active CPU. The catalog is identical for
 * everybody, so the only thing the server was doing per request was deciding
 * which subset of a list it had already built to print. That decision now
 * happens here, against the same prerendered list, and the route is static.
 *
 * The chips stay real `<Link>` anchors (see FilterBar): the URL is still the
 * filter, still shareable, still deep-linkable, still middle-clickable.
 * `useSearchParams` is what makes them work without a round trip — it
 * re-renders this on every client-side navigation between chips.
 */
export function ModelsBrowser({ models }: { models: Model[] }) {
  const params = useSearchParams();

  const filters = useMemo(
    () =>
      resolveModelFilters(
        {
          provider: params.get("provider"),
          status: params.get("status"),
          weights: params.get("weights"),
        },
        models,
      ),
    [params, models],
  );

  return <ModelsSection models={models} {...filters} />;
}
