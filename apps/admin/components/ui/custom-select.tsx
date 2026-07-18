"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  allowClear?: boolean;
  clearLabel?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  loading?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  error?: boolean;
  size?: "default" | "compact";
  className?: string;
}

type DropdownPlacement = "bottom" | "top" | "right" | "left";

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  listMaxHeight: number;
  placement: DropdownPlacement;
}

const triggerClasses = {
  default: "px-4 py-2.5 text-sm",
  compact: "px-3 py-1.5 text-sm",
} as const;

const GAP = 4;
const VIEWPORT_PADDING = 8;
const MAX_LIST_HEIGHT = 240;
const SEARCH_BLOCK_HEIGHT = 52;
const ITEM_HEIGHT = 36;
const LIST_PADDING = 8;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function estimateDropdownHeight(
  itemCount: number,
  searchable: boolean,
  allowClear: boolean,
  loading: boolean,
): number {
  if (loading) return 80;

  let visibleItems = Math.max(itemCount, 1);
  if (allowClear && itemCount > 0) visibleItems += 1;

  let height = LIST_PADDING;
  if (searchable) height += SEARCH_BLOCK_HEIGHT;
  height += Math.min(visibleItems * ITEM_HEIGHT, MAX_LIST_HEIGHT);
  return height;
}

function listHeightForSpace(space: number, searchable: boolean) {
  const reserved = (searchable ? SEARCH_BLOCK_HEIGHT : 0) + LIST_PADDING;
  return Math.max(120, Math.min(MAX_LIST_HEIGHT, space - reserved));
}

function computeDropdownPosition(
  triggerRect: DOMRect,
  dropdownWidth: number,
  dropdownHeight: number,
  searchable: boolean,
): DropdownPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const spaceBelow = viewportHeight - triggerRect.bottom - VIEWPORT_PADDING;
  const spaceAbove = triggerRect.top - VIEWPORT_PADDING;
  const spaceRight = viewportWidth - triggerRect.right - VIEWPORT_PADDING;
  const spaceLeft = triggerRect.left - VIEWPORT_PADDING;

  const clampLeft = (left: number, width = dropdownWidth) =>
    clamp(left, VIEWPORT_PADDING, viewportWidth - width - VIEWPORT_PADDING);

  const clampTop = (top: number, height: number) =>
    clamp(top, VIEWPORT_PADDING, viewportHeight - height - VIEWPORT_PADDING);

  const fitsBelow = spaceBelow >= dropdownHeight;
  const fitsAbove = spaceAbove >= dropdownHeight;
  const fitsRight = spaceRight >= dropdownWidth;
  const fitsLeft = spaceLeft >= dropdownWidth;

  if (fitsBelow) {
    return {
      top: triggerRect.bottom + GAP,
      left: clampLeft(triggerRect.left),
      width: dropdownWidth,
      listMaxHeight: listHeightForSpace(spaceBelow, searchable),
      placement: "bottom",
    };
  }

  if (fitsAbove) {
    const height = dropdownHeight;
    return {
      top: triggerRect.top - height - GAP,
      left: clampLeft(triggerRect.left),
      width: dropdownWidth,
      listMaxHeight: listHeightForSpace(spaceAbove, searchable),
      placement: "top",
    };
  }

  if (fitsRight) {
    const height = Math.min(dropdownHeight, viewportHeight - VIEWPORT_PADDING * 2);
    return {
      top: clampTop(triggerRect.top, height),
      left: triggerRect.right + GAP,
      width: dropdownWidth,
      listMaxHeight: listHeightForSpace(viewportHeight - VIEWPORT_PADDING * 2, searchable),
      placement: "right",
    };
  }

  if (fitsLeft) {
    const height = Math.min(dropdownHeight, viewportHeight - VIEWPORT_PADDING * 2);
    return {
      top: clampTop(triggerRect.top, height),
      left: triggerRect.left - dropdownWidth - GAP,
      width: dropdownWidth,
      listMaxHeight: listHeightForSpace(viewportHeight - VIEWPORT_PADDING * 2, searchable),
      placement: "left",
    };
  }

  // Fallback: use the direction with the most available space.
  const ranked = [
    { placement: "bottom" as DropdownPlacement, space: spaceBelow },
    { placement: "top" as DropdownPlacement, space: spaceAbove },
    { placement: "right" as DropdownPlacement, space: spaceRight },
    { placement: "left" as DropdownPlacement, space: spaceLeft },
  ].sort((a, b) => b.space - a.space);

  const best = ranked[0]?.placement ?? "top";

  if (best === "top") {
    const listMaxHeight = listHeightForSpace(spaceAbove, searchable);
    const height = listMaxHeight + (searchable ? SEARCH_BLOCK_HEIGHT : 0) + LIST_PADDING;
    return {
      top: clampTop(triggerRect.top - height - GAP, height),
      left: clampLeft(triggerRect.left),
      width: dropdownWidth,
      listMaxHeight,
      placement: "top",
    };
  }

  if (best === "right") {
    const width = Math.min(dropdownWidth, Math.max(spaceRight, 160));
    const listMaxHeight = listHeightForSpace(viewportHeight - VIEWPORT_PADDING * 2, searchable);
    const height = listMaxHeight + (searchable ? SEARCH_BLOCK_HEIGHT : 0) + LIST_PADDING;
    return {
      top: clampTop(triggerRect.top, height),
      left: clampLeft(triggerRect.right + GAP, width),
      width,
      listMaxHeight,
      placement: "right",
    };
  }

  if (best === "left") {
    const width = Math.min(dropdownWidth, Math.max(spaceLeft, 160));
    const listMaxHeight = listHeightForSpace(viewportHeight - VIEWPORT_PADDING * 2, searchable);
    const height = listMaxHeight + (searchable ? SEARCH_BLOCK_HEIGHT : 0) + LIST_PADDING;
    return {
      top: clampTop(triggerRect.top, height),
      left: clampLeft(triggerRect.left - width - GAP, width),
      width,
      listMaxHeight,
      placement: "left",
    };
  }

  const listMaxHeight = listHeightForSpace(spaceBelow, searchable);
  const height = listMaxHeight + (searchable ? SEARCH_BLOCK_HEIGHT : 0) + LIST_PADDING;
  return {
    top: clampTop(triggerRect.bottom + GAP, height),
    left: clampLeft(triggerRect.left),
    width: dropdownWidth,
    listMaxHeight,
    placement: "bottom",
  };
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  allowClear = false,
  clearLabel,
  searchable = false,
  searchPlaceholder = "Cari...",
  loading = false,
  emptyLabel = "Tidak ada pilihan",
  disabled = false,
  error = false,
  size = "default",
  className = "",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<DropdownPosition>({
    top: 0,
    left: 0,
    width: 0,
    listMaxHeight: MAX_LIST_HEIGHT,
    placement: "bottom",
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term)
    );
  }, [options, search]);

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    return options.find((opt) => opt.value === value)?.label ?? value;
  }, [options, value]);

  const emptyOptionLabel = clearLabel ?? placeholder;
  const itemCount = filtered.length + (loading ? 1 : 0);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const width = rect.width;
    const measuredHeight = dropdownRef.current?.getBoundingClientRect().height;
    const estimatedHeight = estimateDropdownHeight(itemCount, searchable, allowClear, loading);
    const dropdownHeight = measuredHeight ?? estimatedHeight;

    setPos(computeDropdownPosition(rect, width, dropdownHeight, searchable));
  }, [allowClear, itemCount, loading, searchable]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition, filtered.length, search, loading]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch("");
      }
    }

    function handleReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, updatePosition]);

  const dropdown = open ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[9999] overflow-hidden rounded-md border border-border bg-bg-elevated shadow-lg"
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
      }}
      data-placement={pos.placement}
    >
      {searchable && (
        <div className="border-b border-border p-2">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-bg-tertiary px-3 text-sm text-foreground outline-none placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent"
            autoFocus
          />
        </div>
      )}
      <div className="overflow-y-auto p-1" style={{ maxHeight: pos.listMaxHeight }}>
        {loading ? (
          <div className="px-3 py-2 text-sm text-text-secondary">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-text-secondary">{emptyLabel}</div>
        ) : (
          <>
            {allowClear && (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
                className={`flex w-full items-center rounded-sm px-3 py-2 text-sm hover:bg-bg-hover
                  ${!value ? "bg-bg-hover font-medium text-foreground" : "text-text-secondary"}`}
              >
                {emptyOptionLabel}
              </button>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); setSearch(""); }}
                className={`flex w-full items-center rounded-sm px-3 py-2 text-sm text-foreground hover:bg-bg-hover
                  ${value === opt.value ? "bg-bg-hover font-medium" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const estimatedHeight = estimateDropdownHeight(itemCount, searchable, allowClear, loading);
            setPos(computeDropdownPosition(rect, rect.width, estimatedHeight, searchable));
          }
          setOpen((current) => !current);
        }}
        className={`flex w-full items-center justify-between rounded-lg border border-border bg-bg-tertiary text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50
          ${triggerClasses[size]}
          ${error ? "border-danger" : ""}
          ${open ? "border-accent ring-1 ring-accent" : ""}
          ${className}`}
      >
        <span className={`truncate ${value ? "text-foreground" : "text-text-muted"}`}>
          {value ? selectedLabel : placeholder}
        </span>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-text-muted transition-transform ${open && pos.placement === "top" ? "rotate-180" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {dropdown}
    </>
  );
}
