"use client";

import { useState } from "react";
import { ResourcePage } from "@/components/resource/resource-page";
import { RolePermissionMatrix } from "@/components/resource/role-permission-matrix";
import { rolePermissionResource } from "@/resources/role-permissions";
import { LayoutGrid, Table } from "@/lib/icons";

type ViewMode = "matrix" | "table";

export default function RolePermissionsPage() {
  const [view, setView] = useState<ViewMode>("matrix");

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Role Permissions</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {view === "matrix"
              ? "Pilih role, centang permission, lalu simpan dalam satu klik."
              : "Daftar setiap pasangan role dan permission."}
          </p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === "matrix" ? <RolePermissionMatrix /> : (
        <ResourcePage resource={rolePermissionResource} hideHeader />
      )}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-lg border border-border bg-bg-secondary p-1">
      <button
        type="button"
        onClick={() => onChange("matrix")}
        className={`flex items-center gap-1.5 rounded-md px-3 h-8 text-sm font-medium transition-colors ${
          view === "matrix" ? "bg-accent text-white" : "text-text-secondary hover:text-foreground"
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Matrix
      </button>
      <button
        type="button"
        onClick={() => onChange("table")}
        className={`flex items-center gap-1.5 rounded-md px-3 h-8 text-sm font-medium transition-colors ${
          view === "table" ? "bg-accent text-white" : "text-text-secondary hover:text-foreground"
        }`}
      >
        <Table className="h-3.5 w-3.5" />
        Tabel
      </button>
    </div>
  );
}
