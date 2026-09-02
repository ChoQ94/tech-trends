import { providerClasses } from "@/lib/model-query";
import type { Provider } from "@/lib/types";

/** Provider name with its identity hue as a leading dot. Color = identity. */
export function ProviderLabel({
  provider,
  className = "",
}: {
  provider: Provider;
  className?: string;
}) {
  const { dot } = providerClasses(provider);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">{provider}</span>
    </span>
  );
}
