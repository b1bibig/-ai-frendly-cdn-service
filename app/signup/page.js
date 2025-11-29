'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    contentPolicy: false,
  });

  const allAgreed =
    agreements.terms && agreements.privacy && agreements.contentPolicy;

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!allAgreed) {
      setMessage("모든 약관에 동의해야 회원가입이 가능합니다.");
      return;
    }
    setMessage("");
    setBusy(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, inviteCode }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || "Signup failed");
        return;
      }

      const signInResult = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (signInResult?.error) {
        setMessage("Account created, but automatic login failed.");
        return;
      }

      router.replace("/");
    } catch (error) {
      console.error(error);
      setMessage("Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel stack gap-lg">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Signup</div>
          <h2 className="title">Create account</h2>
          <p className="muted">초대코드가 필요합니다.</p>
        </div>
      </div>

      <form className="stack gap-md" onSubmit={onSubmit}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <label className="field">
          <span>Invite code</span>
          <input
            type="text"
            name="inviteCode"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
          />
        </label>

        <div className="stack gap-sm">
          <div className="checkbox">
            <input
              id="agree-terms"
              type="checkbox"
              checked={agreements.terms}
              onChange={(e) =>
                setAgreements((prev) => ({ ...prev, terms: e.target.checked }))
              }
              required
            />
            <label htmlFor="agree-terms">
              <a className="link" href="/terms" target="_blank" rel="noreferrer">
                이용약관
              </a>
              에 동의합니다.
            </label>
          </div>

          <div className="checkbox">
            <input
              id="agree-privacy"
              type="checkbox"
              checked={agreements.privacy}
              onChange={(e) =>
                setAgreements((prev) => ({
                  ...prev,
                  privacy: e.target.checked,
                }))
              }
              required
            />
            <label htmlFor="agree-privacy">
              <a
                className="link"
                href="/privacy"
                target="_blank"
                rel="noreferrer"
              >
                개인정보 처리방침
              </a>
              에 동의합니다.
            </label>
          </div>

          <div className="checkbox">
            <input
              id="agree-content"
              type="checkbox"
              checked={agreements.contentPolicy}
              onChange={(e) =>
                setAgreements((prev) => ({
                  ...prev,
                  contentPolicy: e.target.checked,
                }))
              }
              required
            />
            <label htmlFor="agree-content">
              <a
                className="link"
                href="/content-policy"
                target="_blank"
                rel="noreferrer"
              >
                콘텐츠 및 이용정책
              </a>
              에 동의합니다.
            </label>
          </div>
        </div>

        <button className="button" type="submit" disabled={busy || !allAgreed}>
          {busy ? "Creating..." : "Create account"}
        </button>
      </form>

      <p className="muted">
        이미 계정이 있나요?{" "}
        <a className="link" href="/login">
          로그인
        </a>
      </p>

      {message && <p className="status">{message}</p>}
    </div>
  );
}
