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

export default function FileBrowserClient({ userEmail }) {
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
  const fileInputRef = useRef(null);
  const [directoryTree, setDirectoryTree] = useState({
    "/": { name: "root", children: [], expanded: true, loading: false, loaded: false },
  });

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

  const directories = useMemo(
    () => visibleItems.filter((item) => item.isDirectory),
    [visibleItems]
  );

  const filesOnly = useMemo(
    () => visibleItems.filter((item) => !item.isDirectory),
    [visibleItems]
  );

  const fetchDirectoryContents = useCallback(async (dirPath) => {
    const response = await fetch(`/api/files?dir=${encodeURIComponent(dirPath)}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Failed to load files");
    }
    return data;
  }, []);

  const updateTreeWithDirectories = useCallback((parentPath, directoryItems) => {
    setDirectoryTree((prev) => {
      const next = { ...prev };
      const parentNode =
        next[parentPath] ||
        ({
          name: parentPath === "/" ? "root" : parentPath.split("/").pop() || parentPath,
          children: [],
          expanded: parentPath === "/",
          loading: false,
          loaded: false,
        });

      next[parentPath] = {
        ...parentNode,
        children: directoryItems.map((dir) => dir.fullPath),
        loaded: true,
        loading: false,
      };

      directoryItems.forEach((dir) => {
        next[dir.fullPath] = {
          name: dir.name,
          children: next[dir.fullPath]?.children || [],
          expanded: next[dir.fullPath]?.expanded || false,
          loading: next[dir.fullPath]?.loading || false,
          loaded: next[dir.fullPath]?.loaded || false,
        };
      });

      return next;
    });
  }, []);

  const fetchTreeChildren = useCallback(
    async (dirPath) => {
      setDirectoryTree((prev) => ({
        ...prev,
        [dirPath]: {
          name: prev[dirPath]?.name || (dirPath === "/" ? "root" : dirPath.split("/").pop()),
          children: prev[dirPath]?.children || [],
          expanded: true,
          loading: true,
          loaded: prev[dirPath]?.loaded || false,
        },
      }));

      try {
        const data = await fetchDirectoryContents(dirPath);
        const directories = data.filter((item) => item.isDirectory);
        updateTreeWithDirectories(dirPath, directories);
      } catch (err) {
        setStatus(err.message || "Failed to load directory tree");
        setDirectoryTree((prev) => ({
          ...prev,
          [dirPath]: { ...prev[dirPath], loading: false },
        }));
      }
    },
    [fetchDirectoryContents, updateTreeWithDirectories]
  );

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchDirectoryContents(currentDir);
      const sorted = [...data].sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
      setItems(sorted);
      updateTreeWithDirectories(
        currentDir,
        sorted.filter((item) => item.isDirectory)
      );
    } catch (err) {
      setError(err.message || "Failed to load files");
    } finally {
      setLoading(false);
      setSelectedPath("");
    }
  }, [currentDir, fetchDirectoryContents, updateTreeWithDirectories]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDirectorySelect = useCallback((path) => {
    setCurrentDir(path);
    setSelectedPath("");
  }, []);

  const handleToggleNode = useCallback(
    (path) => {
      let shouldLoad = false;
      setDirectoryTree((prev) => {
        const node =
          prev[path] ||
          ({
            name: path === "/" ? "root" : path.split("/").pop() || path,
            children: [],
            expanded: false,
            loading: false,
            loaded: false,
          });
        const nextExpanded = !node.expanded;
        if (nextExpanded && !node.loaded && !node.loading) {
          shouldLoad = true;
        }
        return {
          ...prev,
          [path]: {
            ...node,
            expanded: nextExpanded,
          },
        };
      });

      if (shouldLoad) {
        fetchTreeChildren(path);
      }
    },
    [fetchTreeChildren]
  );

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
    if (item.placeholder) return;
    setSelectedPath(item.fullPath);
  }, []);

  const onRowDoubleClick = useCallback(
    (item) => {
      if (item.placeholder) return;
      if (item.isDirectory) {
        handleDirectorySelect(item.fullPath);
      }
    },
    [handleDirectorySelect]
  );

  const onBreadcrumbClick = useCallback(
    (path) => {
      handleDirectorySelect(path);
    },
    [handleDirectorySelect]
  );

  const onCopyCdn = useCallback(async (cdnUrl) => {
    if (!cdnUrl) return;
    try {
      await navigator.clipboard.writeText(cdnUrl);
      setStatus("CDN 링크를 복사했습니다.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "클립보드 복사에 실패했습니다. 수동으로 복사해 주세요.";
      setStatus(message);
    }
  }, []);

  const onSettings = useCallback(() => {
    setStatus("");
  }, []);

  const DirectoryNode = ({ path }) => {
    const node = directoryTree[path];
    if (!node) return null;
    const isActive = currentDir === path;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="토글"
            onClick={() => handleToggleNode(path)}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:border-orange-300 hover:text-orange-500"
          >
            {node.loading ? "···" : node.expanded ? "▾" : "▸"}
          </button>
          <button
            type="button"
            onClick={() => handleDirectorySelect(path)}
            className={`flex-1 rounded-md px-3 py-2 text-left text-sm font-semibold transition border ${
              isActive
                ? "border-orange-300 bg-orange-50 text-orange-600 shadow-sm"
                : "border-transparent bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50"
            }`}
          >
            {node.name}
          </button>
        </div>
        {node.expanded && node.children.length > 0 && (
          <div className="pl-4 border-l border-orange-100 space-y-1">
            {node.children.map((childPath) => (
              <DirectoryNode key={childPath} path={childPath} />
            ))}
          </div>
        )}
      </div>
    );
  };

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
        <aside className="browser-sidebar space-y-4">
          <div className="sidebar-logo">zcxv</div>
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-700">
              <span>폴더 트리</span>
              <span className="text-xs text-gray-400">탐색기</span>
            </div>
            <DirectoryNode path="/" />
          </div>
          <div className="sidebar-paths" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb) => (
              <button
                key={crumb.path}
                className={`sidebar-path ${crumb.path === currentDir ? "active" : ""}`}
                onClick={() => onBreadcrumbClick(crumb.path)}
                type="button"
                disabled={crumb.path === currentDir}
              >
                {crumb.label}
              </button>
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
              <button className="pill" onClick={onDelete} disabled={deleting || !selectedPath}>
                {deleting ? "삭제 중..." : "선택 삭제"}
              </button>
            </div>
          </div>

          <div className="file-list">
            <div className="file-list-header flex items-center justify-between">
              <span className="muted">경로: {currentDir}</span>
              {loading && <span className="muted">불러오는 중...</span>}
            </div>
            {error ? (
              <div className="status error">{error}</div>
            ) : visibleItems.length === 0 ? (
              <div className="status">이 위치에 파일이나 폴더가 없습니다.</div>
            ) : (
              <div className="space-y-6">
                {directories.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-gray-700">폴더</div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {directories.map((item) => {
                        const isSelected = !item.placeholder && selectedPath === item.fullPath;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onRowClick(item)}
                            onDoubleClick={() => onRowDoubleClick(item)}
                            className={`flex aspect-square flex-col items-center justify-center rounded-2xl border text-center transition ${
                              isSelected
                                ? "border-orange-400 bg-orange-50 shadow"
                                : "border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm"
                            } ${item.placeholder ? "opacity-70" : ""}`}
                          >
                            <span className="text-4xl">{iconFor(true)}</span>
                            <span className="mt-2 w-full truncate text-sm font-medium text-gray-800">
                              {item.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filesOnly.length > 0 && (
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
                        {filesOnly.map((item) => {
                          const isSelected = !item.placeholder && selectedPath === item.fullPath;
                          return (
                            <tr
                              key={item.id}
                              className={`${isSelected ? "selected" : ""} ${
                                item.placeholder ? "placeholder-row" : ""
                              }`}
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
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onCopyCdn(item.cdnUrl);
                                      }}
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

                {directories.length > 0 && filesOnly.length === 0 && (
                  <div className="status">이 위치에 파일이 없습니다.</div>
                )}
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
