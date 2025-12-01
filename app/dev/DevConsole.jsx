"use client";

import { useEffect, useMemo, useState } from "react";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { hour12: false });
}

function inviteStatus(invite) {
  const expired = invite.expires_at && new Date(invite.expires_at) < new Date();
  if (invite.used_by_user_id) return { label: "사용됨", tone: "used" };
  if (expired) return { label: "만료", tone: "expired" };
  return { label: "대기", tone: "active" };
}

export default function DevConsole() {
  const [expiresAt, setExpiresAt] = useState("");
  const [inviteResult, setInviteResult] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [busy, setBusy] = useState(false);

  const [invites, setInvites] = useState([]);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [limit, setLimit] = useState("30");
  const [listError, setListError] = useState("");
  const [listBusy, setListBusy] = useState(false);

  useEffect(() => {
    refreshInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshInvites = async () => {
    setListError("");
    setListBusy(true);
    try {
      const parsedLimit = Number.parseInt(limit || "0", 10);
      const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 30;
      const params = new URLSearchParams({
        limit: String(safeLimit),
        includeExpired: includeExpired ? "true" : "false",
      });

      const res = await fetch(`/api/invites?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setListError(data?.error || "초대 목록을 불러오지 못했습니다.");
        return;
      }
      setInvites(data.invites || []);
    } catch (error) {
      console.error(error);
      setListError("요청이 실패했습니다.");
    } finally {
      setListBusy(false);
    }
  };

  const createInvite = async (event) => {
    event.preventDefault();
    setInviteError("");
    setInviteResult("");

    setBusy(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresAt: expiresAt || null }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setInviteError(data?.error || "초대 코드 발행에 실패했습니다.");
        return;
      }
      setInviteResult(data.code);
      refreshInvites();
    } catch (error) {
      console.error(error);
      setInviteError("요청이 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setInviteResult(`${code} (클립보드에 복사됨)`);
    } catch (error) {
      console.error(error);
      setInviteResult("클립보드 복사에 실패했습니다.");
    }
  };

  const inviteRows = useMemo(
    () =>
      invites.map((invite) => {
        const status = inviteStatus(invite);
        return (
          <tr key={invite.code}>
            <td className="mono">{invite.code}</td>
            <td>
              <span className={`badge ${status.tone}`}>{status.label}</span>
            </td>
            <td className="muted">{formatDate(invite.created_at)}</td>
            <td className="muted">{formatDate(invite.expires_at)}</td>
            <td className="muted">{formatDate(invite.used_at)}</td>
            <td>
              <button
                type="button"
                className="tiny-button"
                onClick={() => copyInvite(invite.code)}
              >
                복사
              </button>
            </td>
          </tr>
        );
      }),
    [invites]
  );

  return (
    <div className="stack gap-lg">
      <div className="panel stack gap-lg">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Dev console</div>
            <h2 className="title">api.zcxv.app 관리 도구</h2>
            <p className="muted">
              초대 코드 발행과 만료 관리용 페이지입니다. 관리자 계정으로 로그인된
              경우에만 접근할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      <div className="panel stack gap-lg">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Invite issuing</div>
            <h3 className="title">초대 코드 발행</h3>
            <p className="muted">만료 시간은 선택 사항이며 UTC로 처리됩니다.</p>
          </div>
        </div>

        <form className="stack gap-md" onSubmit={createInvite}>
          <label className="field">
            <span>만료 일시 (선택)</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </label>

          <button className="button" type="submit" disabled={busy}>
            {busy ? "발행 중..." : "초대 코드 발행"}
          </button>
        </form>

        {inviteResult && (
          <div className="result stack gap-md">
            <div>
              <div className="eyebrow">결과</div>
              <div className="mono">{inviteResult}</div>
            </div>
          </div>
        )}
        {inviteError && <p className="status">{inviteError}</p>}
      </div>

      <div className="panel stack gap-lg">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Invite list</div>
            <h3 className="title">초대 코드 현황</h3>
            <p className="muted">최근 발행된 코드와 만료/사용 상태를 확인합니다.</p>
          </div>
          <div className="row gap-sm">
            <label className="field compact">
              <span>갯수</span>
              <input
                type="number"
                min="1"
                max="200"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={includeExpired}
                onChange={(event) => setIncludeExpired(event.target.checked)}
              />
              <span>만료 포함</span>
            </label>
            <button
              type="button"
              className="button ghost"
              onClick={refreshInvites}
              disabled={listBusy}
            >
              {listBusy ? "불러오는 중..." : "목록 새로고침"}
            </button>
          </div>
        </div>

        <div className="table-wrapper scrollable">
          <table className="invite-table">
            <thead>
              <tr>
                <th>코드</th>
                <th>상태</th>
                <th>발행</th>
                <th>만료</th>
                <th>사용</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {inviteRows.length > 0 ? (
                inviteRows
              ) : (
                <tr>
                  <td colSpan={6} className="muted">
                    아직 불러온 초대 코드가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {listError && <p className="status">{listError}</p>}
      </div>
    </div>
  );
}
