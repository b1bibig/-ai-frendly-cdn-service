"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const iconFor = (isDirectory) => (isDirectory ? "📁" : "📄");

const buildBreadcrumbs = (path) => {
  if (path === "/") return [{ label: "root", path: "/" }];
  const parts = path.replace(/^\//, "").split("/");
  const crumbs = [{ label: "root", path: "/" }];
  let current = "";
  for (const part of parts) {
    current = `${current}/${part}`;
    crumbs.push({ label: part, path: current });
  }
  return crumbs;
};

export default function FileBrowserClient({ initialUidToken, userEmail, userRole }) {
  const [currentDir, setCurrentDir] = useState("/");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatuses, setUploadStatuses] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef(null);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(currentDir), [currentDir]);

  const maskedEmail = useMemo(() => {
    if (!userEmail) return "";
    const [local, domain] = userEmail.split("@");
    if (!domain) return `${local.slice(0, 3)}…`;
    const shortenedLocal = local.length > 3 ? `${local.slice(0, 3)}…` : local;
    return `${shortenedLocal}@${domain}`;
  }, [userEmail]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/files?dir=${encodeURIComponent(currentDir)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load files");
      }
      const sorted = [...data].sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
      setItems(sorted);
    } catch (err) {
      setError(err.message || "Failed to load files");
    } finally {
      setLoading(false);
      setSelectedPath("");
    }
  }, [currentDir]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const onUpload = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedFiles.length) {
        setStatus("업로드할 파일을 선택해 주세요.");
        return;
      }

      const updateStatus = (fileName, state) => {
        setUploadStatuses((prev) =>
          prev.map((entry) =>
            entry.name === fileName ? { ...entry, status: state } : entry
          )
        );
      };

      setUploading(true);
      setStatus("");
      let hadFailure = false;
      for (const file of selectedFiles) {
        try {
          updateStatus(file.name, "업로드 중...");
          const formData = new FormData();
          formData.append("file", file);
          formData.append("currentDir", currentDir);
          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          const data = await response.json();
          if (!response.ok || !data?.ok) {
            throw new Error(data?.error || "업로드에 실패했습니다.");
          }
          updateStatus(file.name, "완료");
        } catch (err) {
          hadFailure = true;
          updateStatus(file.name, err.message || "업로드 실패");
        }
      }

      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setStatus(hadFailure ? "업로드를 완료했지만 일부 항목이 실패했습니다." : "업로드 완료!");
      await fetchFiles();
      setUploading(false);
    },
    [currentDir, fetchFiles, selectedFiles]
  );

  const onMkdir = useCallback(async () => {
    if (!newFolderName.trim()) {
      setStatus("폴더 이름을 입력하세요.");
      return;
    }
    setCreating(true);
    setStatus("");
    try {
      const response = await fetch("/api/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim(), parentPath: currentDir }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "폴더 생성 실패");
      }
      setNewFolderName("");
      setStatus("폴더를 만들었습니다.");
      await fetchFiles();
    } catch (err) {
      setStatus(err.message || "폴더 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  }, [currentDir, fetchFiles, newFolderName]);

  const onDelete = useCallback(async () => {
    if (!selectedPath) {
      setStatus("삭제할 항목을 선택하세요.");
      return;
    }
    setDeleting(true);
    setStatus("");
    try {
      const response = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: selectedPath }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "삭제 실패");
      }
      setStatus("삭제 완료.");
      await fetchFiles();
    } catch (err) {
      setStatus(err.message || "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  }, [fetchFiles, selectedPath]);

  const onRowClick = useCallback((item) => {
    setSelectedPath(item.fullPath);
  }, []);

  const onRowDoubleClick = useCallback((item) => {
    if (item.isDirectory) {
      setCurrentDir(item.fullPath);
      setSelectedPath("");
    }
  }, []);

  const onBreadcrumbClick = useCallback((path) => {
    setCurrentDir(path);
    setSelectedPath("");
  }, []);

  return (
    <section className="stack gap-lg">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Status</div>
          <div className="uid" title={userEmail || undefined}>
            {userEmail ? "Signed in" : "Session active"}
          </div>
          {maskedEmail && <div className="muted">{maskedEmail}</div>}
          {userRole === "admin" && initialUidToken && (
            <div className="row gap-sm">
              <button
                className="link"
                type="button"
                onClick={() => setShowDetails((current) => !current)}
              >
                {showDetails ? "Hide details" : "Show details"}
              </button>
              {showDetails && (
                <span className="muted" title="rootUid token">
                  rootUid: {initialUidToken}
                </span>
              )}
            </div>
          )}
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

      <div className="browser-top">
        <div className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.path} className="breadcrumb">
              <button
                className="breadcrumb-button"
                onClick={() => onBreadcrumbClick(crumb.path)}
                disabled={crumb.path === currentDir}
              >
                {crumb.label}
              </button>
              {index < breadcrumbs.length - 1 && <span className="breadcrumb-sep">/</span>}
            </span>
          ))}
        </div>
        <div className="row gap-sm">
          <label className="field compact">
            <span>파일 선택</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setSelectedFiles(files);
                setUploadStatuses(
                  files.map((file) => ({ name: file.name, status: "대기 중" }))
                );
              }}
            />
          </label>
          <button className="button" onClick={onUpload} disabled={uploading}>
            {uploading ? "업로드 중..." : "업로드"}
          </button>
        </div>
      </div>

      <div className="row gap-md">
        <label className="field compact">
          <span>새 폴더</span>
          <input
            type="text"
            placeholder="폴더 이름"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
          />
        </label>
        <button className="pill" onClick={onMkdir} disabled={creating}>
          {creating ? "생성 중..." : "폴더 생성"}
        </button>
        <button className="pill" onClick={onDelete} disabled={deleting || !selectedPath}>
          {deleting ? "삭제 중..." : "선택 삭제"}
        </button>
      </div>

      <div className="file-list">
        <div className="file-list-header">
          <span className="muted">경로: {currentDir}</span>
          {loading && <span className="muted">불러오는 중...</span>}
        </div>
        {error ? (
          <div className="status error">{error}</div>
        ) : items.length === 0 ? (
          <div className="status">이 위치에 파일이나 폴더가 없습니다.</div>
        ) : (
          <div className="table-wrapper file-table-wrapper">
            <table className="file-table">
              <thead>
                <tr>
                  <th>썸네일</th>
                  <th>이름</th>
                  <th>유형</th>
                  <th>크기</th>
                  <th>업데이트</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isSelected = selectedPath === item.fullPath;
                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? "selected" : ""}
                      onClick={() => onRowClick(item)}
                      onDoubleClick={() => onRowDoubleClick(item)}
                    >
                      <td className="thumbnail-cell">
                        {!item.isDirectory && item.thumbnailUrl ? (
                          <a
                            href={item.cdnUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="원본 보기"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.thumbnailUrl}
                              alt={`${item.name} thumbnail`}
                              width={120}
                              height={120}
                              className="thumbnail-image"
                            />
                          </a>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td className="file-name">
                        <span className="file-icon">{iconFor(item.isDirectory)}</span>
                        <span className="file-label">{item.name}</span>
                      </td>
                      <td>{item.isDirectory ? "폴더" : item.mimeType || "파일"}</td>
                      <td>{item.isDirectory ? "-" : formatBytes(item.size)}</td>
                      <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(uploadStatuses.length > 0 || status) && (
        <div className="status">
          {uploadStatuses.length > 0 && (
            <ul className="status-list">
              {uploadStatuses.map((item) => (
                <li key={item.name} className="row gap-sm">
                  <span className="file-label">{item.name}</span>
                  <span className="muted">{item.status}</span>
                </li>
              ))}
            </ul>
          )}
          {status && <p>{status}</p>}
        </div>
      )}
    </section>
  );
}
