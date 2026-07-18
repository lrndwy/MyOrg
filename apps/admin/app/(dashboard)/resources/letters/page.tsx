"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/chrome/PageHeader";
import {
  StatsGrid,
  type StatCard,
} from "@/components/layout/page-header";
import { ViewModal } from "@/components/resource/view-modal";
import { dateRangeToQueryParams, type DateRange } from "@/components/tables/date-filter";
import { DataTable } from "@/components/tables/data-table";
import { TableFilters } from "@/components/tables/table-filters";
import { TablePagination } from "@/components/tables/table-pagination";
import { TableToolbar } from "@/components/tables/table-toolbar";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { IncomingLetterManualReview } from "@/components/resource/incoming-letter-manual-review";
import {
  useBulkDeleteResource,
  useDeleteResource,
  useResource,
} from "@/hooks/use-resource";
import { useToastedMutation } from "@/hooks/use-toasted-mutation";
import { apiClient, uploadFile } from "@/lib/api-client";
import { Loader2, Plus, X, FileText } from "@/lib/icons";
import { letterResource } from "@/resources/letters";
import type { FileRef } from "@repo/shared/schemas";
import type { Letter, LetterTemplate } from "@repo/shared/types";

type LetterType = "outgoing" | "incoming";

interface TemplateVariablesData {
  variables: string[];
  suggested_nomor_surat: string;
  category_id: string;
}

interface OutgoingForm {
  template_id: string;
  subject: string;
  letter_date: string;
  variables: Record<string, string>;
}

const EMPTY_OUTGOING: OutgoingForm = {
  template_id: "",
  subject: "",
  letter_date: new Date().toISOString().slice(0, 10),
  variables: {},
};

interface IncomingForm {
  subject: string;
  document: FileRef | null;
}

const EMPTY_INCOMING: IncomingForm = {
  subject: "",
  document: null,
};

const INCOMING_FILE_ACCEPT =
  ".docx,.pdf,image/jpeg,image/png,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const LETTERS_ENDPOINT = letterResource.endpoint;

function humanizeVar(name: string): string {
  return name
    .replace(/^\{|\}$/g, "")
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

async function uploadAsFileRef(file: File): Promise<FileRef> {
  const res = await uploadFile(file);
  const d = (res.data ?? res) as Record<string, unknown>;
  return {
    url: String(d.url || ""),
    key: String(d.key || d.path || ""),
    name: String(d.name || d.original_name || file.name),
    mime: String(d.mime || d.mime_type || file.type),
    size: Number(d.size || file.size),
    thumbnail_url: (d.thumbnail_url as string) || undefined,
  };
}

function extractApiErrorMessage(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
  return axiosErr?.response?.data?.error?.message || "Gagal memproses file surat masuk";
}

interface IncomingParseResult {
  letter_code: string;
  extracted_text: string;
  detected: boolean;
}

async function parseIncomingDocument(ref: FileRef): Promise<IncomingParseResult> {
  const { data } = await apiClient.post("/api/letters/parse-incoming", {
    document_url: ref.url,
    file_name: ref.name,
  });
  const payload = (data.data ?? data) as IncomingParseResult;
  return {
    letter_code: payload.letter_code ?? "",
    extracted_text: payload.extracted_text ?? "",
    detected: payload.detected ?? !!payload.letter_code,
  };
}

export default function LettersPage() {
  const queryClient = useQueryClient();
  const resource = letterResource;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(resource.table.pageSize ?? 20);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState(resource.table.defaultSort?.key ?? "created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    resource.table.defaultSort?.direction ?? "desc"
  );
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [dateRange, setDateRangeState] = useState<DateRange>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<LetterType>("outgoing");
  const [outgoing, setOutgoing] = useState<OutgoingForm>(EMPTY_OUTGOING);
  const [incoming, setIncoming] = useState<IncomingForm>(EMPTY_INCOMING);
  const [parsedLetterCode, setParsedLetterCode] = useState("");
  const [manualLetterCode, setManualLetterCode] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [manualReviewOpen, setManualReviewOpen] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detectedVars, setDetectedVars] = useState<string[]>([]);
  const [varsLoading, setVarsLoading] = useState(false);
  const [varsError, setVarsError] = useState<string | null>(null);

  const [viewingItem, setViewingItem] = useState<Record<string, unknown> | null>(null);
  const [replaceUploading, setReplaceUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const dateParams = useMemo(() => dateRangeToQueryParams(dateRange), [dateRange]);

  const apiSearchParams = useMemo(() => {
    const sp = new URLSearchParams();
    if (search) sp.set("search", search);
    if (sortBy) {
      sp.set("sort_by", sortBy);
      sp.set("sort_order", sortOrder);
    }
    Object.entries(filters).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    Object.entries(dateParams).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    const df = resource.table.dateFilter?.field;
    if (df && df !== "created_at") sp.set("date_field", df);
    return sp;
  }, [search, sortBy, sortOrder, filters, dateParams, resource.table.dateFilter?.field]);

  const { data, isLoading } = useResource<Letter>(LETTERS_ENDPOINT, {
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
    filters,
    dateParams,
    dateField: resource.table.dateFilter?.field,
  });

  const { mutate: deleteItem, isPending: isDeleting } = useDeleteResource(LETTERS_ENDPOINT);
  const { mutate: bulkDelete, isPending: isBulkDeleting } =
    useBulkDeleteResource(LETTERS_ENDPOINT);

  const templatesQuery = useQuery({
    queryKey: ["letter-templates"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/letter_templates?page_size=100");
      return (data.data ?? []) as LetterTemplate[];
    },
  });

  useEffect(() => {
    if (!outgoing.template_id) {
      setDetectedVars([]);
      setVarsError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setVarsLoading(true);
      setVarsError(null);
      try {
        const { data } = await apiClient.get(
          `/api/letter_templates/${outgoing.template_id}/variables`
        );
        if (cancelled) return;
        const payload = (data.data ?? data) as TemplateVariablesData;
        const vars = payload.variables ?? [];
        setDetectedVars(vars);
        const tpl = (templatesQuery.data ?? []).find((t) => t.id === outgoing.template_id);
        setOutgoing((f) => {
          const next: Record<string, string> = { ...f.variables };
          for (const v of vars) {
            if (next[v] === undefined) next[v] = "";
          }
          if (vars.includes("NOMOR_SURAT") || vars.includes("{NOMOR_SURAT}")) {
            const key = vars.includes("NOMOR_SURAT") ? "NOMOR_SURAT" : "{NOMOR_SURAT}";
            if (!next[key]) next[key] = payload.suggested_nomor_surat || "";
          } else if (payload.suggested_nomor_surat) {
            next["NOMOR_SURAT"] = payload.suggested_nomor_surat;
          }
          return {
            ...f,
            subject: f.subject || tpl?.name || "",
            variables: next,
          };
        });
      } catch (e) {
        if (!cancelled) {
          setDetectedVars([]);
          setVarsError(e instanceof Error ? e.message : "Gagal membaca variabel template");
        }
      } finally {
        if (!cancelled) setVarsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when template changes
  }, [outgoing.template_id, templatesQuery.data]);

  const visibleColumns = useMemo(
    () => resource.table.columns.filter((col) => !col.hidden && !hiddenColumns.includes(col.key)),
    [resource.table.columns, hiddenColumns]
  );

  const handleSort = useCallback(
    (key: string) => {
      if (sortBy === key) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(key);
        setSortOrder("asc");
      }
      setPage(1);
    },
    [sortBy]
  );

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
    setPage(1);
  }, []);

  const setDateRange = useCallback((next: DateRange) => {
    setDateRangeState(next);
    setPage(1);
  }, []);

  const effectiveIncomingCode = useMemo(
    () => (manualReviewOpen ? manualLetterCode.trim() : parsedLetterCode.trim()),
    [manualReviewOpen, manualLetterCode, parsedLetterCode],
  );

  const create = useToastedMutation({
    mutationFn: async () => {
      if (createType === "outgoing") {
        if (!outgoing.template_id) throw new Error("Pilih Letter Template terlebih dahulu.");
        const variables = { ...outgoing.variables };
        const nomor =
          variables["NOMOR_SURAT"] ||
          variables["{NOMOR_SURAT}"] ||
          "";
        const payload = {
          type: "outgoing",
          template_id: outgoing.template_id,
          subject: outgoing.subject,
          letter_date: outgoing.letter_date
            ? new Date(`${outgoing.letter_date}T00:00:00`).toISOString()
            : null,
          letter_code: nomor,
          variables,
        };
        const { data } = await apiClient.post("/api/letters", payload);
        return data.data as Letter;
      }

      if (!incoming.document) {
        throw new Error("File surat masuk wajib diunggah.");
      }
      if (!incoming.subject.trim()) {
        throw new Error("Subject surat masuk wajib diisi.");
      }
      const payload = {
        type: "incoming",
        subject: incoming.subject.trim(),
        document_url: incoming.document.url,
        document_key: incoming.document.key,
        file_name: incoming.document.name,
        letter_code: effectiveIncomingCode,
      };
      const { data } = await apiClient.post("/api/letters", payload);
      return data.data as Letter;
    },
    successMessage: "Letter created",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LETTERS_ENDPOINT] });
      setCreateOpen(false);
      setOutgoing(EMPTY_OUTGOING);
      setIncoming(EMPTY_INCOMING);
      setParsedLetterCode("");
      setManualLetterCode("");
      setExtractedText("");
      setManualReviewOpen(false);
      setParseError(null);
      setDetectedVars([]);
    },
  });

  const canSubmit = useMemo(() => {
    if (createType === "outgoing") {
      return !!outgoing.template_id && !varsLoading && !varsError;
    }
    return (
      !!incoming.subject.trim() &&
      !!incoming.document &&
      !!effectiveIncomingCode &&
      !parseLoading
    );
  }, [createType, outgoing, incoming, varsLoading, varsError, effectiveIncomingCode, parseLoading]);

  const openCreate = (type: LetterType) => {
    setCreateType(type);
    setOutgoing(EMPTY_OUTGOING);
    setIncoming(EMPTY_INCOMING);
    setParsedLetterCode("");
    setManualLetterCode("");
    setExtractedText("");
    setManualReviewOpen(false);
    setParseError(null);
    setParseLoading(false);
    setDetectedVars([]);
    setVarsError(null);
    setCreateOpen(true);
  };

  const handleIncomingUpload = useCallback(async (file: File) => {
    setUploading(true);
    setParseLoading(true);
    setParseError(null);
    setParsedLetterCode("");
    setManualLetterCode("");
    setExtractedText("");
    setManualReviewOpen(false);
    try {
      const ref = await uploadAsFileRef(file);
      setIncoming((f) => ({ ...f, document: ref }));
      const result = await parseIncomingDocument(ref);
      setExtractedText(result.extracted_text);
      if (result.detected && result.letter_code) {
        setParsedLetterCode(result.letter_code);
        setManualReviewOpen(false);
      } else {
        setManualReviewOpen(true);
        setManualLetterCode("");
      }
    } catch (e) {
      setIncoming((f) => ({ ...f, document: null }));
      setParseError(extractApiErrorMessage(e));
      setManualReviewOpen(false);
    } finally {
      setUploading(false);
      setParseLoading(false);
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    setDeletingId(id);
    setConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deletingId) return;
    deleteItem(deletingId, {
      onSuccess: () => {
        setConfirmOpen(false);
        setDeletingId(null);
        setSelectedRows((prev) => prev.filter((id) => id !== deletingId));
      },
    });
  }, [deleteItem, deletingId]);

  const handleBulkDelete = useCallback(() => {
    if (selectedRows.length > 0) setBulkConfirmOpen(true);
  }, [selectedRows]);

  const confirmBulkDelete = useCallback(() => {
    bulkDelete(selectedRows, {
      onSuccess: () => {
        setBulkConfirmOpen(false);
        setSelectedRows([]);
      },
    });
  }, [bulkDelete, selectedRows]);

  const deleteTargetLabel = useMemo(() => {
    if (!deletingId || !data?.data) return "surat ini";
    const row = data.data.find((r) => r.id === deletingId);
    return row?.letter_code || row?.subject || "surat ini";
  }, [data?.data, deletingId]);

  const replaceDocument = useToastedMutation({
    mutationFn: async (file: File) => {
      if (!viewingItem?.id) throw new Error("No letter selected");
      const ref = await uploadAsFileRef(file);
      const { data } = await apiClient.patch(`/api/letters/${viewingItem.id}`, {
        document_url: ref.url,
        file_name: ref.name,
      });
      return data.data as Letter;
    },
    successMessage: "File surat diperbarui",
    onSuccess: (letter) => {
      queryClient.invalidateQueries({ queryKey: [LETTERS_ENDPOINT] });
      setViewingItem(letter as unknown as Record<string, unknown>);
    },
  });

  const displayVars = useMemo(() => {
    const set = new Set(detectedVars.map((v) => v.replace(/^\{|\}$/g, "")));
    if (!set.has("NOMOR_SURAT") && outgoing.variables["NOMOR_SURAT"] !== undefined) {
      set.add("NOMOR_SURAT");
    }
    return Array.from(set).sort((a, b) => {
      if (a === "NOMOR_SURAT") return -1;
      if (b === "NOMOR_SURAT") return 1;
      return a.localeCompare(b);
    });
  }, [detectedVars, outgoing.variables]);

  const statsCards: StatCard[] = useMemo(() => {
    const configured = letterResource.stats;
    if (
      typeof configured === "object" &&
      configured !== null &&
      Array.isArray(configured.cards) &&
      configured.cards.length > 0
    ) {
      return configured.cards;
    }
    const ep = LETTERS_ENDPOINT;
    return [
      { label: "Total", endpoint: `${ep}?page_size=1`, field: "meta.total", icon: "FileText" },
      {
        label: "Total Incoming",
        endpoint: `${ep}?page_size=1&type=incoming`,
        field: "meta.total",
        icon: "Download",
        color: "info",
      },
      {
        label: "Total Outgoing",
        endpoint: `${ep}?page_size=1&type=outgoing`,
        field: "meta.total",
        icon: "Upload",
        color: "success",
      },
      {
        label: "Total This Month",
        endpoint: `${ep}?page_size=1&created_since=30d`,
        field: "meta.total",
        icon: "Calendar",
        color: "warning",
      },
    ];
  }, []);

  return (
    <div>
      <PageHeader
        title="Letters"
        subtitle="Surat masuk & keluar. Outgoing dibuat dari Letter Template (.docx)."
        refreshKeys={[LETTERS_ENDPOINT]}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openCreate("incoming")}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-bg-hover"
            >
              <Plus className="h-4 w-4" />
              Incoming
            </button>
            <button
              type="button"
              onClick={() => openCreate("outgoing")}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" />
              Outgoing
            </button>
          </div>
        }
      />

      <StatsGrid stats={statsCards} className="mb-6" />

      {(templatesQuery.data?.length ?? 0) === 0 && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Belum ada Letter Template. Buat dulu di{" "}
          <a href="/resources/letter-templates" className="underline">
            Letter Templates
          </a>{" "}
          sebelum membuat surat keluar.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
        <TableToolbar
          resource={resource}
          search={search}
          onSearch={handleSearch}
          selectedCount={selectedRows.length}
          onBulkDelete={handleBulkDelete}
          allColumns={resource.table.columns}
          hiddenColumns={hiddenColumns}
          onToggleColumn={(key) =>
            setHiddenColumns((prev) =>
              prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
            )
          }
          data={(data?.data ?? []) as unknown as Record<string, unknown>[]}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          apiSearchParams={apiSearchParams}
        />

        {resource.table.filters && resource.table.filters.length > 0 && (
          <TableFilters
            filters={resource.table.filters}
            values={filters}
            onChange={handleFilter}
          />
        )}

        <DataTable
          columns={visibleColumns}
          data={(data?.data ?? []) as unknown as Record<string, unknown>[]}
          isLoading={isLoading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          selectedRows={selectedRows}
          onSelectRows={setSelectedRows}
          onView={(item) => setViewingItem(item)}
          onDelete={handleDelete}
        />

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={data?.meta?.total ?? 0}
          totalPages={data?.meta?.pages ?? 1}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10">
          <div
            className={`w-full rounded-xl border border-border bg-bg-secondary shadow-xl ${
              createType === "incoming" && manualReviewOpen ? "max-w-5xl" : "max-w-2xl"
            }`}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Create {createType === "outgoing" ? "Outgoing" : "Incoming"} Letter
                </h2>
                <p className="text-sm text-text-secondary">
                  {createType === "outgoing"
                    ? "Pilih template, isi variabel yang terdeteksi, lalu generate .docx."
                    : "Isi subject, unggah file. Nomor surat diparsing otomatis; jika gagal, pratinjau file dan input manual tersedia."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-2 text-text-muted hover:bg-bg-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {createType === "outgoing" ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Letter Template *
                    </label>
                    <select
                      value={outgoing.template_id}
                      onChange={(e) =>
                        setOutgoing({
                          ...EMPTY_OUTGOING,
                          template_id: e.target.value,
                          letter_date: outgoing.letter_date,
                        })
                      }
                      className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm"
                    >
                      <option value="">Pilih template…</option>
                      {(templatesQuery.data ?? []).map((t) => {
                        const cat = t.category as { name?: string } | null | undefined;
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name}
                            {cat?.name ? ` — ${cat.name}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Judul / Subject
                      </label>
                      <input
                        value={outgoing.subject}
                        onChange={(e) => setOutgoing((f) => ({ ...f, subject: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm"
                        placeholder="Opsional (default: nama template)"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Tanggal Surat
                      </label>
                      <input
                        type="date"
                        value={outgoing.letter_date}
                        onChange={(e) =>
                          setOutgoing((f) => ({ ...f, letter_date: e.target.value }))
                        }
                        className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {varsLoading && (
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Membaca variabel dari template…
                    </div>
                  )}
                  {varsError && (
                    <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                      {varsError}
                    </div>
                  )}

                  {outgoing.template_id && !varsLoading && !varsError && (
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Variabel Template
                      </label>
                      {displayVars.length === 0 ? (
                        <p className="text-sm text-text-secondary">
                          Tidak ada placeholder {"{...}"} terdeteksi di file template.
                        </p>
                      ) : (
                        displayVars.map((name) => (
                          <div key={name}>
                            <label className="mb-1 block text-sm font-medium text-foreground">
                              {humanizeVar(name)}
                              <span className="ml-1.5 font-mono text-xs text-text-muted">
                                {"{" + name + "}"}
                              </span>
                              {name === "NOMOR_SURAT" && (
                                <span className="ml-2 text-xs font-normal text-text-muted">
                                  (auto dari kategori, bisa diubah)
                                </span>
                              )}
                            </label>
                            <textarea
                              rows={name === "MATERI" || name.includes("ALASAN") ? 3 : 1}
                              value={outgoing.variables[name] ?? ""}
                              onChange={(e) =>
                                setOutgoing((f) => ({
                                  ...f,
                                  variables: { ...f.variables, [name]: e.target.value },
                                }))
                              }
                              className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Subject *
                    </label>
                    <input
                      value={incoming.subject}
                      onChange={(e) => setIncoming((f) => ({ ...f, subject: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm"
                      placeholder="Perihal / judul surat masuk"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                      File Surat *
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-bg-tertiary px-4 py-3 text-sm text-text-secondary hover:border-accent">
                      {(uploading || parseLoading) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      {incoming.document ? incoming.document.name : "Pilih file (.docx, PDF, gambar)…"}
                      <input
                        type="file"
                        accept={INCOMING_FILE_ACCEPT}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          await handleIncomingUpload(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <p className="mt-1.5 text-xs text-text-muted">
                      Format didukung: DOCX, PDF (termasuk hasil scan), JPG, PNG, WebP. PDF/gambar scan memakai OCR (service <code className="text-xs">ocr</code> di Docker).
                    </p>
                  </div>
                  {parseLoading && (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-secondary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memindai nomor surat dari file…
                    </div>
                  )}
                  {parseError && (
                    <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                      {parseError}
                    </div>
                  )}
                  {parsedLetterCode && !manualReviewOpen && (
                    <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-foreground">
                      Nomor surat terdeteksi:{" "}
                      <span className="font-semibold font-mono">{parsedLetterCode}</span>
                    </div>
                  )}
                  {manualReviewOpen && incoming.document && (
                    <IncomingLetterManualReview
                      document={incoming.document}
                      extractedText={extractedText}
                      letterCode={manualLetterCode}
                      onLetterCodeChange={setManualLetterCode}
                    />
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit || create.isPending || uploading}
                onClick={() => create.mutate()}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {(create.isPending || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingItem && (
        <ViewModal
          item={viewingItem}
          resource={resource}
          onClose={() => setViewingItem(null)}
          extraActions={
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              {typeof viewingItem.document_url === "string" && viewingItem.document_url && (
                <a
                  href={String(viewingItem.document_url)}
                  className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText className="h-4 w-4" />
                  Download file surat
                </a>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Update file surat
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-bg-tertiary px-3 py-2 text-sm text-text-secondary hover:border-accent">
                  {replaceUploading || replaceDocument.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Upload file baru…
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setReplaceUploading(true);
                      try {
                        await replaceDocument.mutateAsync(file);
                      } finally {
                        setReplaceUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          }
        />
      )}

      <ConfirmModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Hapus surat?"
        description={`Hapus ${deleteTargetLabel}? Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus"
        loading={isDeleting}
        variant="danger"
      />
      <ConfirmModal
        open={bulkConfirmOpen}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Hapus beberapa surat?"
        description={`Hapus ${selectedRows.length} surat terpilih?`}
        confirmLabel="Hapus semua"
        loading={isBulkDeleting}
        variant="danger"
      />
    </div>
  );
}
