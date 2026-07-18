"use client";

import { LayoutGrid, Table } from "@/lib/icons";

export type TableCardsViewMode = "table" | "cards";

interface ViewToggleProps {
  view: TableCardsViewMode;
  onChange: (view: TableCardsViewMode) => void;
  className?: string;
}

export function ViewToggle({ view, onChange, className = "" }: ViewToggleProps) {
  return (
    <div
      className={`inline-flex shrink-0 items-center rounded-lg border border-border bg-bg-secondary p-1 ${className}`}
      role="group"
      aria-label="Tampilan data"
    >
      <button
        type="button"
        onClick={() => onChange("table")}
        aria-pressed={view === "table"}
        className={
          "flex items-center gap-1.5 rounded-md px-3 h-8 text-sm font-medium transition-colors " +
          (view === "table" ? "bg-accent text-white" : "text-text-secondary hover:text-foreground")
        }
      >
        <Table className="h-3.5 w-3.5" />
        Tabel
      </button>
      <button
        type="button"
        onClick={() => onChange("cards")}
        aria-pressed={view === "cards"}
        className={
          "flex items-center gap-1.5 rounded-md px-3 h-8 text-sm font-medium transition-colors " +
          (view === "cards" ? "bg-accent text-white" : "text-text-secondary hover:text-foreground")
        }
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Kartu
      </button>
    </div>
  );
}
