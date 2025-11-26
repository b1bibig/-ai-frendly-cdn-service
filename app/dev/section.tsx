"use client";

import { useEffect, useState } from "react";

interface Invite {
  id: string;
  code: string;
  creator?: { email?: string };
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
}

export default function InvitesConsole() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ code: "", maxUses: 1, expiresAt: "", note: "" });

  async function loadInvites() {
    setBusy(true);
    try {
      const res = await fetch(`/api/invites?includeExpired=${includeExpired}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMessage(data?.error?.message || "불러오기에 실패했습니다.");
        return;
      }
      setInvites(data.invites);
    } catch (error) {
      console.error(error);
      setMessage("목록을 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeExpired]);

  async function onCreateInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code || undefined,
          maxUses: Number(form.maxUses),
          expiresAt: form.expiresAt || undefined,
          note: form.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMessage(data?.error?.message || "생성에 실패했습니다.");
        return;
      }
      setMessage(`초대코드 ${data.invite.code} 생성됨`);
      setForm({ code: "", maxUses: 1, expiresAt: "", note: "" });
      loadInvites();
    } catch (error) {
      console.error(error);
      setMessage("생성 요청이 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack gap-lg">
      <form className="stack gap-md" onSubmit={onCreateInvite}>
        <div className="grid two">
          <label className="field">
            <span>Code (빈칸이면 랜덤)</span>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="6~12자"
            />
          </label>
          <label className="field">
            <span>Max uses (-1 무제한)</span>
            <input
              type="number"
              value={form.maxUses}
              min={-1}
              onChange={(e) => setForm((f) => ({ ...f, maxUses: Number(e.target.value) }))}
            />
          </label>
        </div>
        <div className="grid two">
          <label className="field">
            <span>Expires at (optional)</span>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Note</span>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </label>
        </div>
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create invite"}
        </button>
      </form>

      <div className="flex items-center gap-sm">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeExpired}
            onChange={(e) => setIncludeExpired(e.target.checked)}
          />
          <span>만료 포함</span>
        </label>
        <button className="ghost" type="button" onClick={loadInvites} disabled={busy}>
          새로고침
        </button>
      </div>

      {message && <p className="status">{message}</p>}

      <div className="table">
        <div className="table-head">
          <div>Code</div>
          <div>Creator</div>
          <div>Uses</div>
          <div>Expires</div>
          <div>Created</div>
          <div>Note</div>
        </div>
        {invites.map((invite) => (
          <div className="table-row" key={invite.id}>
            <code>{invite.code}</code>
            <span>{invite.creator?.email || "-"}</span>
            <span>
              {invite.usedCount}/{invite.maxUses === -1 ? "∞" : invite.maxUses}
            </span>
            <span>{invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : "-"}</span>
            <span>{new Date(invite.createdAt).toLocaleString()}</span>
            <span>{invite.note || ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
