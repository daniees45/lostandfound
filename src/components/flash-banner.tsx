"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FlashBannerProps = {
  message?: string;
  success?: boolean;
  clearKeys?: string[];
  className?: string;
};

export function FlashBanner({
  message,
  success = false,
  clearKeys = ["claimMessage", "claimSuccess"],
  className = "mt-2",
}: FlashBannerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const nextHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    for (const key of clearKeys) {
      if (params.has(key)) {
        params.delete(key);
        changed = true;
      }
    }

    if (!changed) {
      return null;
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [clearKeys, pathname, searchParams]);

  useEffect(() => {
    if (!message || !nextHref) {
      return;
    }

    router.replace(nextHref, { scroll: false });
  }, [message, nextHref, router]);

  if (!message) {
    return null;
  }

  return (
    <p
      className={`${className} rounded-md px-3 py-2 text-sm ${
        success ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
      }`}
    >
      {message}
    </p>
  );
}