"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { EventStatusBadge } from "@/components/display";
import { formatDateTime } from "@/lib/datetime";

export interface CalendarEvent {
  id: string;
  title: string;
  location?: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
}

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function eventCoversDay(event: CalendarEvent, day: Date): boolean {
  if (!event.start_time) return false;
  const start = startOfDay(new Date(event.start_time));
  if (Number.isNaN(start.getTime())) return false;
  const endRaw = event.end_time ? new Date(event.end_time) : start;
  const end = startOfDay(Number.isNaN(endRaw.getTime()) ? start : endRaw);
  const d = startOfDay(day);
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

function statusDot(status: string): string {
  switch (status) {
    case "ongoing":
      return "bg-success";
    case "upcoming":
      return "bg-info";
    case "cancelled":
      return "bg-danger";
    case "finished":
      return "bg-text-muted";
    default:
      return "bg-accent";
  }
}

function buildMonthCells(year: number, month: number): (Date | null)[] {
  // Monday-first grid
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayIndex = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < mondayIndex; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface EventsCalendarProps {
  events: CalendarEvent[];
  isLoading?: boolean;
}

export function EventsCalendar({ events, isLoading }: EventsCalendarProps) {
  const today = startOfDay(new Date());
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  const eventsByDayKey = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const cell of cells) {
      if (!cell) continue;
      const key = `${cell.getFullYear()}-${cell.getMonth()}-${cell.getDate()}`;
      const dayEvents = events.filter((e) => eventCoversDay(e, cell));
      if (dayEvents.length) map.set(key, dayEvents);
    }
    return map;
  }, [cells, events]);

  const selectedKey = `${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}`;
  const selectedEvents = eventsByDayKey.get(selectedKey) || [];

  const goMonth = (delta: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  return (
    <section className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Kalender acara</h2>
          <p className="text-sm text-text-secondary">
            Berdasarkan jadwal event organisasi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="rounded-lg border border-border p-2 text-text-secondary hover:bg-bg-hover hover:text-foreground"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[9.5rem] text-center text-sm font-semibold text-foreground">
            {MONTHS_ID[month]} {year}
          </p>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="rounded-lg border border-border p-2 text-text-secondary hover:bg-bg-hover hover:text-foreground"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelected(today);
            }}
            className="ml-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-foreground"
          >
            Hari ini
          </button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${idx}`} className="aspect-square min-h-[2.75rem]" />;
              }
              const key = `${cell.getFullYear()}-${cell.getMonth()}-${cell.getDate()}`;
              const dayEvents = eventsByDayKey.get(key) || [];
              const isToday = sameDay(cell, today);
              const isSelected = sameDay(cell, selected);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(cell)}
                  className={
                    "flex aspect-square min-h-[2.75rem] flex-col items-center justify-start rounded-lg border px-1 pt-1.5 text-sm transition-colors " +
                    (isSelected
                      ? "border-accent bg-accent/10 text-foreground"
                      : isToday
                        ? "border-accent/40 bg-bg-elevated text-foreground"
                        : "border-transparent bg-bg-elevated/60 text-foreground hover:border-border hover:bg-bg-hover")
                  }
                >
                  <span
                    className={
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium " +
                      (isToday && !isSelected ? "bg-accent text-white" : "")
                    }
                  >
                    {cell.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="mt-0.5 flex max-w-full items-center justify-center gap-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(e.status)}`}
                          title={e.title}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[9px] leading-none text-text-muted">
                          +{dayEvents.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {isLoading && (
            <p className="mt-3 text-center text-xs text-text-muted">Memuat acara…</p>
          )}
        </div>

        <aside className="border-t border-border bg-bg-tertiary/40 p-4 lg:border-l lg:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {selected.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <div className="mt-3 space-y-2">
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-text-muted">Tidak ada acara pada hari ini.</p>
            ) : (
              selectedEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block rounded-lg border border-border bg-bg-elevated p-3 hover:border-accent/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {event.title}
                    </p>
                    <EventStatusBadge status={event.status} />
                  </div>
                  <p className="mt-1.5 text-xs text-text-secondary">
                    {formatDateTime(event.start_time)}
                  </p>
                  {event.location && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {event.location}
                    </p>
                  )}
                </Link>
              ))
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-3 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-info" /> Upcoming
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Ongoing
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted" /> Finished
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}
