'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

const TOKEN_REGEX = /^[A-Za-z0-9]{4}$/;

export default function LoginPage() {
  const router = useRouter();
  const [uidToken, setUidToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!TOKEN_REGEX.test(uidToken)) {
      setMessage("Enter a 4-character alphanumeric uidToken.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ uidToken }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const errorMessage = data?.error || "Login failed.";
        setMessage(errorMessage);
        return;
      }

      router.replace("/");
    } catch (error) {
      console.error(error);
      setMessage("Request failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel stack gap-lg">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Login</div>
          <h2 className="title">Set uidToken</h2>
          <p className="muted">Only 4 alphanumeric characters are allowed.</p>
        </div>
      </div>

      <form className="stack gap-md" onSubmit={onSubmit}>
        <label className="field">
          <span>uidToken</span>
          <input
            type="text"
            name="uidToken"
            value={uidToken}
            onChange={(e) => setUidToken(e.target.value)}
            maxLength={4}
            placeholder="e.g. a3Bf"
            autoComplete="off"
            required
          />
        </label>

        <button className="button" type="submit" disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </button>
      </form>

      {message && <p className="status">{message}</p>}
    </div>
  );
}
