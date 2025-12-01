"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface SummaryResponse {
  wallet: {
    balanceUsd: number;
    status: "ACTIVE" | "LOW" | "CRITICAL" | "OVERDRAFT" | "SUSPENDED";
    lifetimeChargedUsd: number;
    accountStatus?: string;
  };
  usage: {
    storage: {
      currentGB: number;
      costThisMonthUsd: number;
      lifetimeCostUsd?: number;
    };
    cdn: {
      gbThisMonth: number;
      costThisMonthUsd: number;
      hitsThisMonth: number;
      lifetimeCostUsd?: number;
    };
    totalCostThisMonthUsd: number;
  };
}

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
const formatGb = (value: number) => `${value.toFixed(2)}GB`;

export function BillingGauge() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const res = await fetch("/api/billing/summary", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load billing");
        const json = (await res.json()) as SummaryResponse;
        setData(json);
      } catch (err) {
        console.error(err);
        setError("Billing unavailable");
      }
    };
    load();
  }, []);

  const ratios = useMemo(() => {
    if (!data || data.wallet.lifetimeChargedUsd <= 0) {
      return { storage: 0, cdn: 0, balance: 0, denominator: 0 };
    }
    const denom = Math.max(data.wallet.lifetimeChargedUsd, 0.0001);
    const storageLifetime = data.usage.storage.lifetimeCostUsd ?? 0;
    const cdnLifetime = data.usage.cdn.lifetimeCostUsd ?? 0;
    const storage = Math.max(storageLifetime, 0) / denom;
    const cdn = Math.max(cdnLifetime, 0) / denom;
    const balance = Math.max(data.wallet.balanceUsd, 0) / denom;
    return { storage, cdn, balance, denominator: denom };
  }, [data]);

  const handleMouseEnter = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    hoverTimer.current = setTimeout(() => setShowTooltip(true), 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    hideTimer.current = setTimeout(() => setShowTooltip(false), 300);
  };

  const barInactive = error || !data || ratios.denominator === 0;
  const isSuspended = data?.wallet.status === "SUSPENDED";

  const totalTooltip = data
    ? data.wallet.balanceUsd + data.usage.storage.costThisMonthUsd + data.usage.cdn.costThisMonthUsd
    : 0;

  return (
    <div className="billing-gauge-wrapper" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="billing-top-numbers">
        <div className="billing-top-line balance">Balance: {formatCurrency(data?.wallet.balanceUsd ?? 0)}</div>
        <div className="billing-top-line storage">Storage: {formatCurrency(data?.usage.storage.costThisMonthUsd ?? 0)}</div>
        <div className="billing-top-line cdn">CDN: {formatCurrency(data?.usage.cdn.costThisMonthUsd ?? 0)}</div>
      </div>
      <div
        className={`billing-bar ${barInactive ? "billing-bar-inactive" : ""} ${
          isSuspended ? "billing-bar-suspended" : ""
        }`}
      >
        {!barInactive && (
          <>
            <div className="billing-bar-segment storage" style={{ flex: ratios.storage }} />
            <div className="billing-bar-segment cdn" style={{ flex: ratios.cdn }} />
            <div className="billing-bar-segment balance" style={{ flex: ratios.balance }} />
          </>
        )}
      </div>
      {showTooltip && data && (
        <div className="billing-tooltip show">
          <div className="tooltip-line">Storage ({formatGb(data.usage.storage.currentGB)} / {formatCurrency(data.usage.storage.costThisMonthUsd)})</div>
          <div className="tooltip-line">CDN ({formatGb(data.usage.cdn.gbThisMonth)} / {formatCurrency(data.usage.cdn.costThisMonthUsd)})</div>
          <div className="tooltip-line">Balance {formatCurrency(data.wallet.balanceUsd)}</div>
          <div className="tooltip-line total">Total {formatCurrency(totalTooltip)}</div>
        </div>
      )}
      {error && <div className="billing-error">{error}</div>}
    </div>
  );
}
