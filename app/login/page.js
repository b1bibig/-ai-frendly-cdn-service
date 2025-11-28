'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setMessage(result.error === "CredentialsSignin" ? "Invalid credentials" : result.error);
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
          <div className="eyebrow">Login</div>
          <h2 className="title">Sign in</h2>
          <p className="muted">이메일과 비밀번호로 로그인하세요.</p>
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
            autoComplete="current-password"
            required
          />
        </label>

        <button className="button" type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="muted">
        계정이 없나요?{" "}
        <a className="link" href="/signup">
          회원가입
        </a>
      </p>

      {message && <p className="status">{message}</p>}
    </div>
  );
}
