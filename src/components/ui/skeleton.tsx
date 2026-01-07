import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Skeleton(
  props: HTMLAttributes<HTMLDivElement> & { className?: string },
) {
  const { className, ...rest } = props;
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200/70 dark:bg-white/10",
        className,
      )}
      {...rest}
    />
  );
}
