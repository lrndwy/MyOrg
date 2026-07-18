"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "@/lib/icons";

const tabs = [
  { href: (id: string) => `/myorg/events/${id}/kepanitiaan`, label: "Overview" },
  { href: (id: string) => `/myorg/events/${id}/kepanitiaan/sies`, label: "Sie" },
  { href: (id: string) => `/myorg/events/${id}/kepanitiaan/sub-events`, label: "Sub Event" },
] as const;

export function CommitteeNav({ active }: { active: "overview" | "sies" | "sub-events" }) {
  const params = useParams<{ id: string }>();
  const eventId = params.id;

  return (
    <div className="mb-6 space-y-4">
      <Link
        href="/resources/events"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Events
      </Link>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-bg-secondary p-1 w-fit">
        {tabs.map((tab, i) => {
          const key = (["overview", "sies", "sub-events"] as const)[i];
          const isActive = active === key;
          return (
            <Link
              key={tab.label}
              href={tab.href(eventId)}
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (isActive ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-hover")
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
