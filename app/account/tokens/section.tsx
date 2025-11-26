"use client";

import { useEffect, useState } from "react";

interface Token {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export default function TokenConsole() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [rawToken, setRawToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadTokens() {
    setBusy(true);
    try {
      const res = await fetch("/api/tokens", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMessage(data?.error?.message || "토큰 목록을 불러오지 못했습니다.");
        return;
      }
      setTokens(data.tokens);
    } catch (error) {
      console.error(error);
      setMessage("목록 불러오기에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadTokens();
  }, []);

  async function onCreateToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setRawToken("");

    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMessage(data?.error?.message || "생성 실패");
        return;
      }
      setRawToken(data.rawToken);
      setName("");
      loadTokens();
    } catch (error) {
      console.error(error);
      setMessage("생성 요청 실패");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/tokens", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMessage(data?.error?.message || "취소 실패");
        return;
      }
      loadTokens();
    } catch (error) {
      console.error(error);
      setMessage("취소 요청 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack gap-lg">
      <form className="stack gap-md" onSubmit={onCreateToken}>
        <label className="field">
          <span>Token name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create token"}
        </button>
      </form>

      {rawToken && (
        <div className="alert">
          <div className="eyebrow">새 토큰</div>
          <p className="mono">{rawToken}</p>
          <p className="muted">다시 표시되지 않으니 복사해두세요.</p>
        </div>
      )}

      {message && <p className="status">{message}</p>}

      <div className="table">
        <div className="table-head">
          <div>Name</div>
          <div>Created</div>
          <div>Last used</div>
          <div>Status</div>
          <div>Action</div>
        </div>
        {tokens.map((token) => (
          <div className="table-row" key={token.id}>
            <span>{token.name}</span>
            <span>{new Date(token.createdAt).toLocaleString()}</span>
            <span>{token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "-"}</span>
            <span>{token.revokedAt ? "Revoked" : "Active"}</span>
            <button className="ghost" type="button" disabled={busy || !!token.revokedAt} onClick={() => revoke(token.id)}>
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
