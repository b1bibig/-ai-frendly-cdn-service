'use client';

import { useCallback, useState } from "react";
import { signOut } from "next-auth/react";

const TOKEN_REGEX = /^[A-Za-z0-9]{4}$/;

export default function UploaderClient({ initialUidToken, userEmail }) {
  const [uidToken, setUidToken] = useState(initialUidToken || "");
  const [path, setPath] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [cdnUrl, setCdnUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const validateClientPath = useCallback((value) => {
    if (!value.trim()) return "Enter a relative path (e.g. folder/file.png)";
    if (value.startsWith("/") || value.endsWith("/"))
      return "No leading or trailing slashes are allowed.";
    if (value.includes("..") || value.includes("\\"))
      return "Path cannot contain '..' or backslashes.";
    return "";
  }, []);

  const onSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setStatus("");
      setCdnUrl("");

      if (!uidToken || !TOKEN_REGEX.test(uidToken)) {
        setStatus("Login required. Set uidToken at /login.");
        return;
      }

      const pathError = validateClientPath(path);
      if (pathError) {
        setStatus(pathError);
        return;
      }

      if (!file) {
        setStatus("Choose a file to upload.");
        return;
      }

      const formData = new FormData();
      formData.append("path", path.trim());
      formData.append("file", file);

      setBusy(true);
      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const data = await response.json();
        if (!response.ok || !data?.ok) {
          const message = data?.error || "Upload failed.";
          setStatus(message);
          return;
        }

        setCdnUrl(data.cdnUrl);
        setStatus("Upload completed");
      } catch (error) {
        setStatus("Request failed. Please try again.");
        console.error(error);
      } finally {
        setBusy(false);
      }
    },
    [file, path, uidToken, validateClientPath]
  );

  return (
    <section className="stack gap-lg">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Signed in</div>
          <div className="uid">{userEmail || "Not logged in"}</div>
          <div className="muted">uidToken: {uidToken || "Not set"}</div>
        </div>
        <div className="header-actions">
          <a className="link" href="/signup">
            회원가입
          </a>
          <button
            className="pill"
            type="button"
            onClick={async () => {
              await signOut({ callbackUrl: "/login" });
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <form className="stack gap-md" onSubmit={onSubmit}>
        <label className="field">
          <span>Relative path (after uidToken)</span>
          <input
            type="text"
            name="path"
            placeholder="e.g. test/cafe.png"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            autoComplete="off"
            required
          />
        </label>

        <label className="field">
          <span>Image file</span>
          <input
            type="file"
            name="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
        </label>

        <button className="button" type="submit" disabled={busy}>
          {busy ? "Uploading..." : "Upload"}
        </button>
      </form>

      {status && <p className="status">{status}</p>}
      {cdnUrl && (
        <div className="result">
          <div className="eyebrow">CDN URL</div>
          <a className="mono" href={cdnUrl} target="_blank" rel="noreferrer">
            {cdnUrl}
          </a>
        </div>
      )}
    </section>
  );
}
