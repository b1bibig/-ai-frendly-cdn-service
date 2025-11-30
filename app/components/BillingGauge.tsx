"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface BillingSummaryResponse {
  wallet: {
    balanceUsd: number;
    status: "ACTIVE" | "LOW" | "CRITICAL" | "OVERDRAFT" | "SUSPENDED";
    lifetimeChargedUsd: number;
  };
  usage: {
    storage: { currentGB: number; costThisMonthUsd: number };
    cdn: {
      gbThisMonth: number;
      bytesThisMonth: number;
      hitsThisMonth: number;
      costThisMonthUsd: number;
    };
    totalCostThisMonthUsd: number;
  };
  lifetime: {
    storageCostUsd: number;
    cdnCostUsd: number;
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export function BillingGauge() {
  const [data, setData] = useState<BillingSummaryResponse | null>(null);
  const [hovered, setHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchSummary() {
      try {
        const response = await fetch("/api/billing/summary", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load summary");
        const json = (await response.json()) as BillingSummaryResponse;
        if (active) setData(json);
      } catch (error) {
        console.error("Failed to refresh billing summary", error);
        if (active) setData(null);
      }
    }

    fetchSummary();
    const id = setInterval(fetchSummary, 45000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);

    if (hovered) {
      hoverTimer.current = setTimeout(() => setShowTooltip(true), 500);
    } else {
      leaveTimer.current = setTimeout(() => setShowTooltip(false), 250);
    }

    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, [hovered]);

  const { storageWidth, cdnWidth, balanceWidth, disabled, status } = useMemo(() => {
    if (!data || data.wallet.lifetimeChargedUsd <= 0) {
      return {
        storageWidth: 0,
        cdnWidth: 0,
        balanceWidth: 0,
        disabled: true,
        status: data?.wallet?.status ?? "ACTIVE",
      } as const;
    }
    const total = data.wallet.lifetimeChargedUsd || 1;
    const storagePct = clampPercent((data.lifetime.storageCostUsd / total) * 100);
    const cdnPct = clampPercent((data.lifetime.cdnCostUsd / total) * 100);
    const balancePct = clampPercent((Math.max(data.wallet.balanceUsd, 0) / total) * 100);
    return {
      storageWidth: storagePct,
      cdnWidth: cdnPct,
      balanceWidth: balancePct,
      disabled: false,
      status: data.wallet.status,
    } as const;
  }, [data]);

  const tooltipContent = data && (
    <div className="billing-tooltip">
      <div className="billing-tooltip-row">
        <span>Storage</span>
        <span>
          {data.usage.storage.currentGB.toFixed(1)}GB / ${data.lifetime.storageCostUsd.toFixed(2)}
        </span>
      </div>
      <div className="billing-tooltip-row">
        <span>CDN</span>
        <span>
          {data.usage.cdn.gbThisMonth.toFixed(1)}GB / ${data.lifetime.cdnCostUsd.toFixed(2)}
        </span>
      </div>
      <div className="billing-tooltip-row">
        <span>Balance</span>
        <span>${data.wallet.balanceUsd.toFixed(2)}</span>
      </div>
      <div className="billing-tooltip-row billing-tooltip-total">
        <span>Total</span>
        <span>${data.wallet.lifetimeChargedUsd.toFixed(2)}</span>
      </div>
    </div>
  );

  const statusClass = `billing-gauge status-${status?.toLowerCase?.() ?? "active"}`;

  return (
    <div className="billing-gauge-wrapper">
      <div
        className={`${statusClass} ${disabled ? "is-disabled" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="billing-gauge-bar">
          <div className="billing-segment storage" style={{ width: `${storageWidth}%` }} />
          <div className="billing-segment cdn" style={{ width: `${cdnWidth}%` }} />
          <div className="billing-segment balance" style={{ width: `${balanceWidth}%` }} />
          {status === "SUSPENDED" && <div className="billing-suspended-icon">!</div>}
        </div>
        {disabled && <span className="billing-inactive-label">비활성 상태</span>}
      </div>
      {showTooltip && tooltipContent}
    </div>
  );
}
