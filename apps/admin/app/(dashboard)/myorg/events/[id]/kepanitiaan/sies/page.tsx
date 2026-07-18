"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PermissionGate } from "@/components/auth/permission-gate";
import { CommitteeNav } from "@/components/events/committee-nav";
import { PageHeader } from "@/components/chrome/PageHeader";
import { useEventCommitteeOverview } from "@/hooks/use-event-committee";
import { useCreateResource, useDeleteResource } from "@/hooks/use-resource";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, Trash2 } from "@/lib/icons";
import type { User } from "@repo/shared/types";

export default function EventKepanitiaanSiesPage() {
  return (
    <PermissionGate permission="events.committee.manage">
      <SiesContent />
    </PermissionGate>
  );
}

function SiesContent() {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: overview, isLoading } = useEventCommitteeOverview(params.id);
  const { mutate: createSie, isPending: creatingSie } = useCreateResource("/api/event_committee_sies");
  const { mutate: createMember, isPending: creatingMember } = useCreateResource("/api/event_committee_members");
  const { mutate: deleteMember } = useDeleteResource("/api/event_committee_members");
  const { mutate: deleteSie } = useDeleteResource("/api/event_committee_sies");

  const [sieName, setSieName] = useState("");
  const [memberForms, setMemberForms] = useState<Record<string, { userId: string; role: string }>>({});

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users", "options"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/users?page_size=200");
      return (data.data ?? []) as User[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["events", params.id, "committee"] });

  const addSie = () => {
    if (!sieName.trim()) return;
    createSie(
      {
        event_id: params.id,
        name: sieName.trim(),
        order_index: (overview?.sies.length ?? 0) + 1,
      },
      { onSuccess: () => { setSieName(""); invalidate(); } },
    );
  };

  const addMember = (sieId: string) => {
    const form = memberForms[sieId];
    if (!form?.userId) return;
    createMember(
      { sie_id: sieId, user_id: form.userId, role: form.role || "anggota" },
      { onSuccess: () => invalidate() },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Sie Kepanitiaan" subtitle={overview?.event.title} />
      <CommitteeNav active="sies" />

      <div className="mb-6 flex flex-wrap gap-2">
        <input
          value={sieName}
          onChange={(e) => setSieName(e.target.value)}
          placeholder="Nama Sie (mis. Acara, Humas)"
          className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addSie}
          disabled={creatingSie}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Tambah Sie
        </button>
      </div>

      <div className="space-y-6">
        {(overview?.sies ?? []).map((sie) => (
          <div key={sie.id} className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{sie.name}</h3>
                {sie.description && <p className="text-sm text-text-secondary">{sie.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Hapus Sie "${sie.name}"?`)) {
                    deleteSie(sie.id, { onSuccess: invalidate });
                  }
                }}
                className="text-danger hover:text-danger/80"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <ul className="mb-3 space-y-2">
              {(sie.members ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-lg bg-bg-primary px-3 py-2 text-sm">
                  <span>
                    {(m.user as { full_name?: string; email?: string } | null)?.full_name ||
                      (m.user as { full_name?: string; email?: string } | null)?.email ||
                      m.user_id}
                    <span className="ml-2 text-xs text-text-muted capitalize">({m.role})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteMember(m.id, { onSuccess: invalidate })}
                    className="text-xs text-danger hover:underline"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              <select
                value={memberForms[sie.id]?.userId ?? ""}
                onChange={(e) =>
                  setMemberForms((prev) => ({
                    ...prev,
                    [sie.id]: { userId: e.target.value, role: prev[sie.id]?.role ?? "anggota" },
                  }))
                }
                className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
              >
                <option value="">Pilih anggota…</option>
                {(users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
              </select>
              <select
                value={memberForms[sie.id]?.role ?? "anggota"}
                onChange={(e) =>
                  setMemberForms((prev) => ({
                    ...prev,
                    [sie.id]: { userId: prev[sie.id]?.userId ?? "", role: e.target.value },
                  }))
                }
                className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
              >
                <option value="anggota">Anggota</option>
                <option value="ketua_sie">Ketua Sie</option>
              </select>
              <button
                type="button"
                onClick={() => addMember(sie.id)}
                disabled={creatingMember}
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg-hover"
              >
                Tambah Anggota
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
