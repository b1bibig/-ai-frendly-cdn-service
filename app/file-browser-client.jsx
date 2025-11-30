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

const ensureThumbnailUrl = (item) => {
  if (item?.isDirectory) return null;

  const existing = item?.thumbnailUrl;
  if (existing && existing.includes("_THNL/")) return existing;

  const fallback = existing || item?.cdnUrl;
  if (!fallback) return existing || null;

  try {
    const parsed = new URL(fallback);
    const [uid, ...rest] = parsed.pathname.replace(/^\/+/, "").split("/");

    if (!uid || uid.endsWith("_THNL")) return existing || fallback;

    parsed.pathname = `/${[`${uid}_THNL`, ...rest].join("/")}`;
    return parsed.toString();
  } catch {
    return existing || null;
  }
};

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

export default function FileBrowserClient({ userEmail }) {
  const [currentDir, setCurrentDir] = useState("/");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatuses, setUploadStatuses] = useState([]);
  const [moveAnchor, setMoveAnchor] = useState(null);
  const [rangeAnchorIndex, setRangeAnchorIndex] = useState(null);
  const fileInputRef = useRef(null);
  const dragPathsRef = useRef([]);
  const clearDragPaths = useCallback(() => {
    dragPathsRef.current = [];
  }, []);

  const clearMoveAnchor = useCallback(() => setMoveAnchor(null), []);
  const clearRangeAnchor = useCallback(() => setRangeAnchorIndex(null), []);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(currentDir), [currentDir]);

  const visibleItems = useMemo(() => {
    if (items.length === 0 && currentDir === "/") {
      return [
        {
          id: "__root-placeholder__",
          name: "기본 폴더",
          isDirectory: true,
          fullPath: "/",
          size: null,
          mimeType: "폴더",
          updatedAt: null,
          placeholder: true,
        },
      ];
    }
    return items;
  }, [currentDir, items]);

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
      const normalized = data.map((item) => ({
        ...item,
        thumbnailUrl: ensureThumbnailUrl(item),
      }));
      const sorted = [...normalized].sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
      setItems(sorted);
    } catch (err) {
      setError(err.message || "Failed to load files");
    } finally {
      setLoading(false);
      setSelectedPaths([]);
      setRangeAnchorIndex(null);
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

  const deletePaths = useCallback(
    async (paths) => {
      if (!paths?.length) {
        setStatus("삭제할 항목을 선택하세요.");
        return;
      }
      setDeleting(true);
      setStatus("");
      const failures = [];
      try {
        for (const path of paths) {
          try {
            const response = await fetch("/api/files", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filePath: path }),
            });
            const data = await response.json();
            if (!response.ok || !data?.ok) {
              throw new Error(data?.error || "삭제 실패");
            }
          } catch (err) {
            failures.push(`${path}: ${err.message || "삭제 실패"}`);
          }
        }
        setSelectedPaths([]);
        clearRangeAnchor();
        await fetchFiles();
        if (failures.length > 0) {
          setStatus(`일부 항목 삭제 실패: ${failures.join(", ")}`);
        } else {
          setStatus("삭제 완료.");
        }
      } catch (err) {
        setStatus(err.message || "삭제 중 오류가 발생했습니다.");
      } finally {
        setDeleting(false);
      }
    },
    [clearRangeAnchor, fetchFiles]
  );

  const onDelete = useCallback(async () => {
    await deletePaths(selectedPaths);
  }, [deletePaths, selectedPaths]);

  const onRowClick = useCallback((item, event) => {
    if (item.placeholder) return;
    setSelectedPaths((prev) => {
      if (event?.metaKey || event?.ctrlKey) {
        return prev.includes(item.fullPath)
          ? prev.filter((path) => path !== item.fullPath)
          : [...prev, item.fullPath];
      }
      return [item.fullPath];
    });
  }, []);

  const movePaths = useCallback(
    async (paths, destinationDir) => {
      if (!paths?.length) {
        setStatus("이동할 항목을 선택하세요.");
        return;
      }

      setStatus("");
      try {
        const response = await fetch("/api/files/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sources: paths, destinationDir }),
        });
        const data = await response.json();

        if (!response.ok || !data) {
          throw new Error(data?.error || "이동에 실패했습니다.");
        }

        const failed = Array.isArray(data.results)
          ? data.results.filter((item) => !item.ok)
          : [];

        if (failed.length > 0) {
          setStatus(
            `일부 항목 이동 실패: ${failed
              .map((item) => `${item.path}${item.error ? ` (${item.error})` : ""}`)
              .join(", ")}`
          );
        } else if (data.ok) {
          setStatus("이동 완료.");
        } else {
          setStatus(data?.error || "이동에 실패했습니다.");
        }
        setSelectedPaths([]);
        clearMoveAnchor();
        clearRangeAnchor();
        await fetchFiles();
      } catch (err) {
        setStatus(err.message || "이동 중 오류가 발생했습니다.");
      }
    },
    [clearMoveAnchor, clearRangeAnchor, fetchFiles]
  );

  const setMoveStartFromPaths = useCallback(
    (paths) => {
      if (!paths?.length) return;
      setMoveAnchor({ paths, from: currentDir });
      setStatus("이동 시작을 설정했습니다. 대상 폴더를 더블클릭하세요.");
    },
    [currentDir]
  );

  const startRangeSelection = useCallback(
    (index) => {
      const item = visibleItems[index];
      if (!item || item.placeholder || item.isDirectory) return;
      setRangeAnchorIndex(index);
      const paths = [item.fullPath];
      setSelectedPaths(paths);
      setMoveStartFromPaths(paths);
      setStatus("범위 선택을 시작했습니다. 끝 항목을 더블클릭하세요.");
    },
    [setMoveStartFromPaths, visibleItems]
  );

  const selectRangeToIndex = useCallback(
    (index) => {
      if (rangeAnchorIndex === null) return;
      const start = Math.min(rangeAnchorIndex, index);
      const end = Math.max(rangeAnchorIndex, index);
      const rangeItems = visibleItems.slice(start, end + 1).filter((item) => !item.placeholder);
      const paths = rangeItems.map((entry) => entry.fullPath);
      setSelectedPaths(paths);
      setMoveStartFromPaths(paths);
      setRangeAnchorIndex(null);
      setStatus(`${paths.length}개를 선택했습니다. 이동하려면 대상 폴더를 더블클릭하세요.`);
    },
    [rangeAnchorIndex, setMoveStartFromPaths, visibleItems]
  );

  const onRowDoubleClick = useCallback(
    async (item, index) => {
      if (item.placeholder) return;

      if (rangeAnchorIndex !== null && !item.isDirectory) {
        selectRangeToIndex(index);
        return;
      }

      if (moveAnchor) {
        if (!item.isDirectory) {
          setStatus("대상은 폴더여야 합니다. 폴더를 더블클릭해 주세요.");
          return;
        }
        await movePaths(moveAnchor.paths, item.fullPath);
        clearMoveAnchor();
        clearRangeAnchor();
        return;
      }

      if (!moveAnchor && item.isDirectory) {
        setCurrentDir(item.fullPath);
        setSelectedPaths([]);
        clearRangeAnchor();
        return;
      }

      startRangeSelection(index);
    },
    [
      clearMoveAnchor,
      clearRangeAnchor,
      moveAnchor,
      movePaths,
      rangeAnchorIndex,
      selectRangeToIndex,
      startRangeSelection,
    ]
  );

  const onBreadcrumbClick = useCallback(
    (path) => {
      setCurrentDir(path);
      setSelectedPaths([]);
      clearMoveAnchor();
      clearRangeAnchor();
    },
    [clearMoveAnchor, clearRangeAnchor]
  );

  const onCopyCdn = useCallback(async (cdnUrl) => {
    if (!cdnUrl) return;
    try {
      await navigator.clipboard.writeText(cdnUrl);
      setStatus("CDN 링크를 복사했습니다.");
    } catch {
      setStatus("클립보드 복사에 실패했습니다. 수동으로 복사해 주세요.");
    }
  }, []);

  const onSettings = useCallback(() => {
    setStatus("");
  }, []);

  const getDragPaths = useCallback(
    (event) => {
      const payload =
        event?.dataTransfer?.getData("application/json") ||
        event?.dataTransfer?.getData("text/plain");
      if (payload) {
        try {
          const parsed = JSON.parse(payload);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          const paths = payload
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
          if (paths.length) return paths;
        }
      }
      if (dragPathsRef.current.length > 0) {
        return dragPathsRef.current;
      }
      return selectedPaths;
    },
    [selectedPaths]
  );

  const allowDrop = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onBreadcrumbDoubleClick = useCallback(
    async (path) => {
      if (!moveAnchor) {
        onBreadcrumbClick(path);
        return;
      }
      await movePaths(moveAnchor.paths, path);
      clearMoveAnchor();
    },
    [clearMoveAnchor, moveAnchor, movePaths, onBreadcrumbClick]
  );

  const onRowDragStart = useCallback(
    (event, item) => {
      if (item.placeholder) return;
      const paths = selectedPaths.includes(item.fullPath)
        ? selectedPaths
        : [item.fullPath];
      dragPathsRef.current = paths;
      event.dataTransfer.effectAllowed = "move";
      const payload = JSON.stringify(paths);
      event.dataTransfer.setData("application/json", payload);
      event.dataTransfer.setData("text/plain", payload);
    },
    [selectedPaths]
  );

  const onDropToFolder = useCallback(
    async (event, folderPath) => {
      event.preventDefault();
      const paths = getDragPaths(event);
      if (!paths.length) return;
      await movePaths(paths, folderPath);
      clearDragPaths();
    },
    [clearDragPaths, getDragPaths, movePaths]
  );

  const onDropToDelete = useCallback(
    async (event) => {
      event.preventDefault();
      const paths = getDragPaths(event);
      if (!paths.length) return;
      await deletePaths(paths);
      clearDragPaths();
    },
    [clearDragPaths, deletePaths, getDragPaths]
  );

  return (
    <section className="browser-shell stack gap-lg">
      <div className="browser-header">
        <div className="browser-account">
          <div className="account-title">Signed in</div>
          {userEmail && (
            <div className="account-email" title={userEmail}>
              {userEmail}
            </div>
          )}
        </div>
        <div className="header-actions">
          <button className="neutral-button" type="button" onClick={onSettings}>
            설정
          </button>
          <button
            className="neutral-button"
            type="button"
            onClick={async () => {
              await signOut({ callbackUrl: "/login" });
            }}
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="browser-layout">
        <aside className="browser-sidebar">
          <div className="sidebar-logo">zcxv</div>
          <div className="sidebar-divider" />
          <div className="sidebar-paths" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb) => (
              <div
                key={crumb.path}
                onDragOver={allowDrop}
                onDrop={(event) => onDropToFolder(event, crumb.path)}
              >
                <button
                  className={`sidebar-path ${crumb.path === currentDir ? "active" : ""}`}
                  onClick={() => onBreadcrumbClick(crumb.path)}
                  onDoubleClick={() => onBreadcrumbDoubleClick(crumb.path)}
                  type="button"
                  disabled={crumb.path === currentDir}
                >
                  {crumb.label}
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="browser-main stack gap-lg">
          <div className="browser-top">
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
              <button
                className="pill"
                onClick={onDelete}
                disabled={deleting}
                onDragOver={allowDrop}
                onDrop={onDropToDelete}
                title="선택하거나 드래그하여 삭제"
              >
                {deleting ? "삭제 중..." : "선택 삭제"}
              </button>
            </div>
          </div>

          {moveAnchor && (
            <div className="status info row gap-sm align-center">
              <span>
                이동 시작: {moveAnchor.paths.length}개 선택됨. 대상 폴더를 더블클릭하세요.
              </span>
              <button className="pill" type="button" onClick={clearMoveAnchor}>
                이동 취소
              </button>
            </div>
          )}

          <div className="file-list">
            <div className="file-list-header">
              <span className="muted">경로: {currentDir}</span>
              {loading && <span className="muted">불러오는 중...</span>}
            </div>
            {error ? (
              <div className="status error">{error}</div>
            ) : visibleItems.length === 0 ? (
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
                  {visibleItems.map((item, index) => {
                    const isSelected =
                      !item.placeholder && selectedPaths.includes(item.fullPath);
                    return (
                      <tr
                        key={item.id}
                          className={`${isSelected ? "selected" : ""} ${
                            item.placeholder ? "placeholder-row" : ""
                          }`}
                          draggable={!item.placeholder}
                          onDragStart={(event) => onRowDragStart(event, item)}
                          onDragEnd={clearDragPaths}
                          onDragOver={
                            item.isDirectory && !item.placeholder ? allowDrop : undefined
                          }
                          onDrop={
                            item.isDirectory
                              ? (event) => onDropToFolder(event, item.fullPath)
                              : undefined
                          }
                          onClick={(event) => onRowClick(item, event)}
                          onDoubleClick={() => onRowDoubleClick(item, index)}
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
                            <div className="file-name-main">
                              <span className="file-icon">{iconFor(item.isDirectory)}</span>
                              <span className="file-label">{item.name}</span>
                            </div>
                            {!item.isDirectory && item.cdnUrl && (
                              <div className="cdn-row">
                                <a
                                  href={item.cdnUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="cdn-link"
                                >
                                  {item.cdnUrl}
                                </a>
                                <button
                                  className="copy-button"
                                  type="button"
                                  onClick={() => onCopyCdn(item.cdnUrl)}
                                >
                                  복사
                                </button>
                              </div>
                            )}
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
        </div>
      </div>
    </section>
  );
}
