"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    devCredit?: (email: string, amountUsd: number) => Promise<unknown>;
  }
}

export function DevCreditHelper() {
  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "development") return;
    const devToken = process.env.NEXT_PUBLIC_DEV_ADMIN_TOKEN || process.env.DEV_ADMIN_TOKEN;
    window.devCredit = async (email: string, amountUsd: number) => {
      const res = await fetch("/api/dev/credit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-token": devToken || "",
        },
        body: JSON.stringify({ email, amountUsd }),
      });
      const data = await res.json();
      console.log(data);
      return data;
    };
  }, []);

  return null;
}
