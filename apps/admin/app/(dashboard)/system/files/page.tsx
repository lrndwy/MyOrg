"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useUploads,
  useUploadFile,
  useDeleteUpload,
  useUploadStats,
  useStorageFolders,
  useStorageBreadcrumb,
  useCreateStorageFolder,
  useDeleteStorageFolder,
  useMoveUpload,
  fetchUploadDownloadUrl,
} from "@/hooks/use-system";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { CreateFolderModal } from "@/components/storage/create-folder-modal";
import {
  FolderOpen,
  FolderPlus,
  Upload,
  Loader2,
  Image as ImageIcon,
  Play,
  Music,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Search,
  Download,
  Trash2,
  ChevronRight,
  Home,
  Eye,
  LayoutGrid,
  List,
} from "@/lib/icons";
import type { Upload as UploadRecord, StorageFolder } from "@repo/shared/types";

const KIND_FILTERS = [
  { id: "", label: "Semua" },
  { id: "image", label: "Foto" },
  { id: "video", label: "Video" },
  { id: "document", label: "Dokumen" },
  { id: "pdf", label: "PDF" },
  { id: "spreadsheet", label: "Spreadsheet" },
  { id: "other", label: "Lainnya" },
] as const;

type DeleteTarget =
  | { type: "file"; item: UploadRecord }
  | { type: "folder"; item: StorageFolder };

type ViewMode = "grid" | "list";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function mimeKind(mime: string): string {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv") return "spreadsheet";
  if (mime.includes("wordprocessing") || mime === "application/msword") return "document";
  return "other";
}

export default function FilesPage() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [selectedFile, setSelectedFile] = useState<UploadRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | "root" | null>(null);
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);

  const { data, isLoading } = useUploads(page, 24, {
    search,
    kind,
    folderId: currentFolderId,
  });
  const { data: foldersResp, isLoading: foldersLoading } = useStorageFolders(currentFolderId);
  const { data: breadcrumbResp } = useStorageBreadcrumb(currentFolderId);
  const { data: statsResp } = useUploadStats();
  const uploadFile = useUploadFile(currentFolderId);
  const deleteUpload = useDeleteUpload();
  const deleteFolder = useDeleteStorageFolder();
  const createFolder = useCreateStorageFolder();
  const moveUpload = useMoveUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploads = data?.data ?? [];
  const meta = data?.meta;
  const folders = foldersResp?.data ?? [];
  const breadcrumbs = breadcrumbResp?.data ?? [];
  const stats = statsResp?.data;

  const navigateToFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setPage(1);
    setSelectedFile(null);
    setPreviewUrl(null);
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => uploadFile.mutate(file));
  };

  const handleCreateFolder = (name: string) => {
    createFolder.mutate(
      { name, parent_id: currentFolderId },
      { onSuccess: () => setCreateFolderOpen(false) },
    );
  };

  const handleDropOnFolder = (folderId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const fileId = e.dataTransfer.getData("application/x-upload-id") || draggingFileId;
    if (!fileId) return;
    moveUpload.mutate({ id: fileId, folderId });
    setDraggingFileId(null);
  };

  const openPreview = useCallback(async (file: UploadRecord) => {
    setSelectedFile(file);
    setPreviewUrl(null);
    const kind = mimeKind(file.mime_type);
    if (kind === "image") {
      setPreviewUrl(file.thumbnail_url || file.url);
      return;
    }
    if (kind === "video" || kind === "pdf" || kind === "audio") {
      setPreviewLoading(true);
      try {
        const dl = await fetchUploadDownloadUrl(file.id);
        setPreviewUrl(dl.url);
      } catch {
        setPreviewUrl(null);
      } finally {
        setPreviewLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedFile && uploads.every((u) => u.id !== selectedFile.id)) {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  }, [uploads, selectedFile]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "file") {
      deleteUpload.mutate(deleteTarget.item.id, {
        onSuccess: () => {
          if (selectedFile?.id === deleteTarget.item.id) {
            setSelectedFile(null);
            setPreviewUrl(null);
          }
          setDeleteTarget(null);
        },
      });
    } else {
      deleteFolder.mutate(deleteTarget.item.id, {
        onSuccess: () => {
          if (currentFolderId === deleteTarget.item.id) {
            navigateToFolder(deleteTarget.item.parent_id ?? null);
          }
          setDeleteTarget(null);
        },
      });
    }
  };

  const deleteLoading = deleteUpload.isPending || deleteFolder.isPending;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Penyimpanan Cloud</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Kelola file organisasi — folder, drag & drop, dan preview.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCreateFolderOpen(true)}
              disabled={createFolder.isPending}
              className="flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm font-medium hover:bg-bg-hover"
            >
              {createFolder.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4" />
              )}
              Folder baru
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              <Upload className="h-4 w-4" />
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </div>

        {stats && <StorageStatsPanel stats={stats} />}

        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => navigateToFolder(null)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverFolderId("root");
            }}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => handleDropOnFolder(null, e)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 hover:bg-bg-hover ${
              dragOverFolderId === "root" ? "bg-accent/10 ring-1 ring-accent" : ""
            } ${currentFolderId === null ? "font-semibold text-accent" : "text-text-secondary"}`}
          >
            <Home className="h-3.5 w-3.5" />
            Semua file
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
              <button
                type="button"
                onClick={() => navigateToFolder(crumb.id)}
                className={`rounded-md px-2 py-1 hover:bg-bg-hover ${
                  currentFolderId === crumb.id ? "font-semibold text-accent" : "text-text-secondary"
                }`}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              placeholder="Cari nama file…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-border bg-bg-secondary py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-secondary p-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Tampilan grid"
              className={`rounded-md p-2 transition-colors ${
                viewMode === "grid"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:bg-bg-hover"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="Tampilan list"
              className={`rounded-md p-2 transition-colors ${
                viewMode === "list"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:bg-bg-hover"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.id || "all"}
              type="button"
              onClick={() => {
                setKind(f.id);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                kind === f.id
                  ? "bg-accent text-white"
                  : "border border-border bg-bg-secondary text-text-secondary hover:bg-bg-hover"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setUploadDragOver(true);
          }}
          onDragLeave={() => setUploadDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setUploadDragOver(false);
            if (e.dataTransfer.files.length > 0) {
              handleFiles(e.dataTransfer.files);
            }
          }}
          className={`shrink-0 rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
            uploadDragOver ? "border-accent bg-accent/5" : "border-border"
          }`}
        >
          <p className="text-sm text-text-secondary">
            Seret file ke sini untuk upload ke folder ini, atau pindahkan file ke folder di bawah.
          </p>
        </div>

        {(uploadFile.isPending || moveUpload.isPending) && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-4 py-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            {uploadFile.isPending ? "Mengupload…" : "Memindahkan file…"}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading || foldersLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : folders.length === 0 && uploads.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <FolderOpen className="mb-3 h-12 w-12 text-text-muted" />
              <p className="text-sm text-text-secondary">Folder ini kosong</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {folders.map((folder) => (
                <FolderTile
                  key={folder.id}
                  folder={folder}
                  isDropTarget={dragOverFolderId === folder.id}
                  onOpen={() => navigateToFolder(folder.id)}
                  onDelete={() => setDeleteTarget({ type: "folder", item: folder })}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(e) => handleDropOnFolder(folder.id, e)}
                />
              ))}
              {uploads.map((upload) => (
                <FileTile
                  key={upload.id}
                  upload={upload}
                  selected={selectedFile?.id === upload.id}
                  onSelect={() => openPreview(upload)}
                  onDelete={() => setDeleteTarget({ type: "file", item: upload })}
                  onDragStart={(id) => setDraggingFileId(id)}
                  onDragEnd={() => setDraggingFileId(null)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="hidden grid-cols-[minmax(0,1fr)_100px_120px_88px] gap-3 border-b border-border bg-bg-tertiary px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted sm:grid">
                <span>Nama</span>
                <span>Ukuran</span>
                <span>Tanggal</span>
                <span className="text-right">Aksi</span>
              </div>
              <div className="divide-y divide-border">
                {folders.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    isDropTarget={dragOverFolderId === folder.id}
                    onOpen={() => navigateToFolder(folder.id)}
                    onDelete={() => setDeleteTarget({ type: "folder", item: folder })}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverFolderId(folder.id);
                    }}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={(e) => handleDropOnFolder(folder.id, e)}
                  />
                ))}
                {uploads.map((upload) => (
                  <FileRow
                    key={upload.id}
                    upload={upload}
                    selected={selectedFile?.id === upload.id}
                    onSelect={() => openPreview(upload)}
                    onDelete={() => setDeleteTarget({ type: "file", item: upload })}
                    onDragStart={(id) => setDraggingFileId(id)}
                    onDragEnd={() => setDraggingFileId(null)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="text-sm text-text-secondary">
              Halaman {page} / {meta.pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
              disabled={page === meta.pages}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Berikutnya
            </button>
          </div>
        )}
      </div>

      <PreviewPanel
        file={selectedFile}
        previewUrl={previewUrl}
        loading={previewLoading}
        onClose={() => {
          setSelectedFile(null);
          setPreviewUrl(null);
        }}
      />

      <CreateFolderModal
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        onSubmit={handleCreateFolder}
        loading={createFolder.isPending}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        variant="danger"
        title={
          deleteTarget?.type === "folder"
            ? "Hapus folder?"
            : "Hapus file?"
        }
        description={
          deleteTarget?.type === "folder"
            ? `Folder "${deleteTarget.item.name}" dan seluruh isinya akan dihapus permanen.`
            : `File "${deleteTarget?.type === "file" ? deleteTarget.item.original_name : ""}" akan dihapus permanen.`
        }
        confirmLabel="Hapus"
        cancelLabel="Batal"
      />
    </div>
  );
}

function FolderRow({
  folder,
  isDropTarget,
  onOpen,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  folder: StorageFolder;
  isDropTarget: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group flex items-center gap-3 px-3 py-2.5 transition-colors sm:grid sm:grid-cols-[minmax(0,1fr)_100px_120px_88px] sm:gap-3 sm:px-4 ${
        isDropTarget ? "bg-accent/10 ring-1 ring-inset ring-accent/40" : "hover:bg-bg-hover"
      }`}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:contents">
        <span className="flex min-w-0 items-center gap-3 sm:col-span-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
            <FolderOpen className="h-5 w-5 text-accent" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{folder.name}</span>
            <span className="text-xs text-text-muted sm:hidden">{formatDate(folder.created_at)}</span>
          </span>
        </span>
        <span className="hidden text-sm text-text-muted sm:block">—</span>
        <span className="hidden text-sm text-text-muted sm:block">{formatDate(folder.created_at)}</span>
      </button>
      <div className="ml-auto flex shrink-0 gap-1 sm:ml-0 sm:justify-end">
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border border-border p-1.5 text-text-muted opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
          title="Hapus folder"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function FileRow({
  upload,
  selected,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  upload: UploadRecord;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const isImage = upload.mime_type.startsWith("image/");

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-upload-id", upload.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(upload.id);
      }}
      onDragEnd={onDragEnd}
      className={`group flex cursor-grab items-center gap-3 px-3 py-2.5 active:cursor-grabbing sm:grid sm:grid-cols-[minmax(0,1fr)_100px_120px_88px] sm:gap-3 sm:px-4 ${
        selected ? "bg-accent/5 ring-1 ring-inset ring-accent/30" : "hover:bg-bg-hover"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:contents">
        <span className="flex min-w-0 items-center gap-3 sm:col-span-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-tertiary">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={upload.thumbnail_url || upload.url}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <FileTypeIcon mime={upload.mime_type} compact />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{upload.original_name}</span>
            <span className="text-xs text-text-muted sm:hidden">
              {formatFileSize(upload.size)} · {formatDate(upload.created_at)}
            </span>
          </span>
        </span>
        <span className="hidden text-sm tabular-nums text-text-secondary sm:block">
          {formatFileSize(upload.size)}
        </span>
        <span className="hidden text-sm text-text-muted sm:block">{formatDate(upload.created_at)}</span>
      </button>
      <div className="ml-auto flex shrink-0 gap-1 sm:ml-0 sm:justify-end">
        <button
          type="button"
          onClick={onSelect}
          className="rounded-md border border-border p-1.5 text-text-muted hover:bg-bg-hover"
          title="Preview"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border border-border p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
          title="Hapus"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function FolderTile({
  folder,
  isDropTarget,
  onOpen,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  folder: StorageFolder;
  isDropTarget: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group relative rounded-xl border bg-bg-secondary transition-colors ${
        isDropTarget ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/40"
      }`}
    >
      <button type="button" onClick={onOpen} className="flex w-full flex-col items-center p-4">
        <FolderOpen className="h-12 w-12 text-accent" />
        <p className="mt-2 w-full truncate text-center text-sm font-medium">{folder.name}</p>
        <p className="mt-0.5 text-xs text-text-muted">{formatDate(folder.created_at)}</p>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white opacity-0 transition-opacity hover:bg-danger group-hover:opacity-100"
        title="Hapus folder"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FileTile({
  upload,
  selected,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  upload: UploadRecord;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const isImage = upload.mime_type.startsWith("image/");

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-upload-id", upload.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(upload.id);
      }}
      onDragEnd={onDragEnd}
      className={`group relative cursor-grab overflow-hidden rounded-xl border bg-bg-secondary active:cursor-grabbing ${
        selected ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-accent/40"
      }`}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="flex aspect-square items-center justify-center bg-bg-tertiary">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={upload.thumbnail_url || upload.url}
              alt={upload.original_name}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <FileTypeIcon mime={upload.mime_type} />
          )}
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-medium">{upload.original_name}</p>
          <div className="mt-1 flex justify-between text-xs text-text-muted">
            <span>{formatFileSize(upload.size)}</span>
            <span>{formatDate(upload.created_at)}</span>
          </div>
        </div>
      </button>
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="rounded-lg bg-black/50 p-1.5 text-white hover:bg-accent"
          title="Preview"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-lg bg-black/50 p-1.5 text-white hover:bg-danger"
          title="Hapus"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function FileTypeIcon({ mime, compact = false }: { mime: string; compact?: boolean }) {
  const kind = mimeKind(mime);
  const icons = {
    image: ImageIcon,
    video: Play,
    audio: Music,
    pdf: FileText,
    document: FileText,
    spreadsheet: FileSpreadsheet,
    other: FileIcon,
  };
  const Icon = icons[kind as keyof typeof icons] || FileIcon;
  if (compact) {
    return <Icon className="h-4 w-4 text-text-muted" />;
  }
  return (
    <div className="p-4 text-center">
      <Icon className="mx-auto h-10 w-10 text-text-muted" />
      <p className="mt-1 text-xs uppercase text-text-muted">{mime.split("/")[1]?.slice(0, 8)}</p>
    </div>
  );
}

function PreviewPanel({
  file,
  previewUrl,
  loading,
  onClose,
}: {
  file: UploadRecord | null;
  previewUrl: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!file) {
    return (
      <aside className="hidden w-full shrink-0 rounded-xl border border-border bg-bg-secondary p-6 lg:block lg:w-96">
        <p className="text-sm text-text-muted">Pilih file untuk preview</p>
      </aside>
    );
  }

  const kind = mimeKind(file.mime_type);

  const handleDownload = async () => {
    const dl = await fetchUploadDownloadUrl(file.id);
    const a = document.createElement("a");
    a.href = dl.url;
    a.download = file.original_name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <aside className="flex w-full shrink-0 flex-col rounded-xl border border-border bg-bg-secondary lg:w-96">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="truncate text-sm font-semibold">{file.original_name}</h2>
        <button type="button" onClick={onClose} className="text-xs text-text-muted hover:text-foreground">
          Tutup
        </button>
      </div>
      <div className="flex min-h-[200px] flex-1 items-center justify-center overflow-hidden bg-bg-tertiary p-4">
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        ) : kind === "image" && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={file.original_name} className="max-h-64 w-full object-contain" />
        ) : kind === "video" && previewUrl ? (
          <video src={previewUrl} controls className="max-h-64 w-full rounded-lg" />
        ) : kind === "audio" && previewUrl ? (
          <audio src={previewUrl} controls className="w-full" />
        ) : kind === "pdf" && previewUrl ? (
          <iframe src={previewUrl} title={file.original_name} className="h-72 w-full rounded-lg bg-white" />
        ) : (
          <div className="text-center">
            <FileTypeIcon mime={file.mime_type} />
            <p className="mt-2 text-xs text-text-muted">Preview tidak tersedia untuk tipe ini</p>
          </div>
        )}
      </div>
      <div className="space-y-2 border-t border-border p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Ukuran</span>
          <span>{formatFileSize(file.size)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Tipe</span>
          <span className="truncate pl-4 text-right">{file.mime_type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Diupload</span>
          <span>{formatDate(file.created_at)}</span>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 hover:bg-bg-hover"
        >
          <Download className="h-4 w-4" />
          Unduh
        </button>
      </div>
    </aside>
  );
}

interface UploadStatsLite {
  total_count: number;
  total_size: number;
  by_kind: { kind: string; count: number; size: number }[];
}

const KIND_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  image: { label: "Foto", icon: ImageIcon, tint: "text-accent" },
  video: { label: "Video", icon: Play, tint: "text-info" },
  audio: { label: "Audio", icon: Music, tint: "text-info" },
  pdf: { label: "PDF", icon: FileText, tint: "text-danger" },
  document: { label: "Dokumen", icon: FileText, tint: "text-info" },
  spreadsheet: { label: "Spreadsheet", icon: FileSpreadsheet, tint: "text-success" },
  other: { label: "Lainnya", icon: FileIcon, tint: "text-text-muted" },
};

function formatStatsSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function StorageStatsPanel({ stats }: { stats: UploadStatsLite }) {
  const rows = [...(stats.by_kind ?? [])].sort((a, b) => b.size - a.size);
  return (
    <div className="rounded-xl border border-border bg-bg-secondary">
      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-3">
        <div className="bg-bg-secondary p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Total file</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{stats.total_count.toLocaleString()}</p>
        </div>
        <div className="bg-bg-secondary p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Penyimpanan</p>
          <p className="mt-1 text-xl font-bold">{formatStatsSize(stats.total_size)}</p>
        </div>
        <div className="col-span-2 bg-bg-secondary p-3 md:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Rata-rata</p>
          <p className="mt-1 text-xl font-bold">
            {stats.total_count > 0 ? formatStatsSize(stats.total_size / stats.total_count) : "—"}
          </p>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="hidden gap-2 border-t border-border px-4 py-2 sm:grid sm:grid-cols-2">
          {rows.slice(0, 4).map((row) => {
            const meta = KIND_META[row.kind] || KIND_META.other;
            const Icon = meta.icon;
            return (
              <div key={row.kind} className="flex items-center gap-2 text-xs">
                <Icon className={"h-3.5 w-3.5 " + meta.tint} />
                <span>{meta.label}</span>
                <span className="ml-auto text-text-muted">{row.count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
