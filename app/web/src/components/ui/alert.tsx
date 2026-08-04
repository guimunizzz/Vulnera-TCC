import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/** Usado pra exibir mensagens de erro de API (useApiError) nos formulários. */
export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border border-severity-critical/40 bg-severity-critical/10 px-3 py-2 text-sm text-severity-critical",
        className,
      )}
      {...props}
    />
  );
}
