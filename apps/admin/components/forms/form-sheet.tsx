"use client";

import type { ResourceDefinition } from "@/lib/resource";
import { FormBuilder } from "./form-builder";
import { useCreateResource, useResourceItem, useUpdateResource } from "@/hooks/use-resource";
import { Loader2, X } from "@/lib/icons";

interface FormSheetProps {
  resource: ResourceDefinition;
  item: Record<string, unknown> | null;
  onClose: () => void;
}

export function FormSheet({ resource, item, onClose }: FormSheetProps) {
  const isEdit = item !== null;
  const editId = isEdit ? String(item.id) : "";
  const { data: fresh, isLoading: isLoadingItem } = useResourceItem<Record<string, unknown>>(
    resource.endpoint,
    editId,
    { enabled: isEdit && !!editId }
  );
  const { mutate: create, isPending: isCreating } = useCreateResource(resource.endpoint);
  const { mutate: update, isPending: isUpdating } = useUpdateResource(resource.endpoint);

  // Prefer GET /:id so nested associations (e.g. announcement attachments)
  // are present — list rows may be stale or incomplete.
  const formItem = isEdit
    ? ((fresh?.data as Record<string, unknown> | undefined) ?? (item as Record<string, unknown>))
    : null;

  const handleSubmit = (data: Record<string, unknown>) => {
    if (isEdit && item) {
      update(
        { id: String(item.id), body: data },
        { onSuccess: () => onClose() }
      );
    } else {
      create(data, { onSuccess: () => onClose() });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border border-border bg-bg-secondary shadow-2xl md:max-h-none md:h-full md:max-w-lg md:rounded-none md:rounded-l-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit" : "Create"} {resource.label?.singular ?? resource.name}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-secondary hover:bg-bg-hover hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {isEdit && isLoadingItem && !(fresh as { data?: unknown } | undefined)?.data ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          ) : (
            <FormBuilder
              key={isEdit ? `edit-${editId}-${formItem?.updated_at ?? ""}` : "create"}
              form={resource.form}
              defaultValues={formItem ?? undefined}
              onSubmit={handleSubmit}
              onCancel={onClose}
              isSubmitting={isCreating || isUpdating}
              submitLabel={isEdit ? "Update" : "Create"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
