"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

export interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
}

const GAP = 4;
const VIEWPORT_PADDING = 8;
const MAX_LIST_HEIGHT = 240;

export function FormSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  required = false,
  disabled = false,
  emptyLabel = "No options available",
  className = "",
}: FormSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: MAX_LIST_HEIGHT,
    placement: "bottom" as "bottom" | "top",
  });

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    return options.find((opt) => opt.value === value)?.label ?? value;
  }, [options, value]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;

    setPos({
      top: rect.bottom + GAP,
      left: Math.max(VIEWPORT_PADDING, Math.min(rect.left, window.innerWidth - rect.width - VIEWPORT_PADDING)),
      width: rect.width,
      maxHeight: Math.max(120, Math.min(MAX_LIST_HEIGHT, spaceBelow - GAP)),
      placement: "bottom",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition, options.length]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, updatePosition]);

  const dropdown = open
    ? createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          id={id ? `${id}-listbox` : undefined}
          className="fixed z-[9999] overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-lg"
          style={{
            top: pos.top,
            left: pos.left,
            width: pos.width,
          }}
          data-placement={pos.placement}
        >
          <div className="overflow-y-auto p-1" style={{ maxHeight: pos.maxHeight }}>
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-secondary">{emptyLabel}</div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-bg-hover
                    ${value === opt.value ? "bg-bg-hover font-medium" : ""}`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={`relative ${className}`}>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          value={value}
          onChange={() => {}}
          required
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={id}
        onClick={() => {
          if (disabled) return;
          if (!open) updatePosition();
          setOpen((current) => !current);
        }}
        className={`flex w-full items-center justify-between rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground transition-colors
          focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20
          disabled:cursor-not-allowed disabled:opacity-50
          ${open ? "border-accent ring-2 ring-accent/20" : ""}`}
      >
        <span className={`truncate ${value ? "text-foreground" : "text-text-muted"}`}>
          {value ? selectedLabel : placeholder}
        </span>
        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {dropdown}
    </div>
  );
}

/** Normalizes field_options from API/admin (array, JSON string, or newline list). */
export function parseFieldOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map(String).map((s) => s.trim()).filter(Boolean);
        }
      } catch {
        /* fall through */
      }
    }
    return trimmed
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}
