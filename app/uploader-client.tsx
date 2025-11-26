"use client";

import { useCallback, useState } from "react";
import { UserRole } from "@prisma/client";

interface Props {
  userId: string;
  userEmail: string;
  role: UserRole;
}

export default function UploaderClient({ userId, userEmail, role }: Props) {
  const [path, setPath] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [cdnUrl, setCdnUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const validateClientPath = useCallback((value: string) => {
    if (!value.trim()) return "상대 경로를 입력하세요 (예: folder/file.png)";
    if (value.startsWith("/") || value.endsWith("/"))
      return "앞뒤 슬래시는 사용할 수 없습니다.";
    if (value.includes("..") || value.includes("\\"))
      return "경로에 '..' 또는 백슬래시를 포함할 수 없습니다.";
    return "";
  }, []);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setStatus("");
      setCdnUrl("");

      const pathError = validateClientPath(path);
      if (pathError) {
        setStatus(pathError);
        return;
      }

      if (!file) {
        setStatus("업로드할 파일을 선택하세요.");
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
          const message = data?.error?.message || data?.error || "Upload failed.";
          setStatus(message);
          return;
        }

        setCdnUrl(data.cdnUrl);
        setStatus("업로드 완료");
      } catch (error) {
        setStatus("요청에 실패했습니다. 다시 시도하세요.");
        console.error(error);
      } finally {
        setBusy(false);
      }
    },
    [file, path, validateClientPath]
  );

  return (
    <section className="stack gap-lg">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Signed in</div>
          <div className="uid">{userEmail || "Not logged in"}</div>
          <div className="muted">폴더: {userId}</div>
          <div className="muted">역할: {role}</div>
        </div>
        <div className="header-actions">
          <a className="link" href="/signup">
            회원가입
          </a>
          <button
            className="pill"
            type="button"
            onClick={async () => {
              await fetch("/api/auth/login", { method: "DELETE" });
              window.location.href = "/login";
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <form className="stack gap-md" onSubmit={onSubmit}>
        <label className="field">
          <span>상대 경로 (사용자 폴더 이후)</span>
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
          <span>이미지 파일</span>
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
