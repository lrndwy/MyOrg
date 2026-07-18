"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { SubmissionDetailsModal } from "@/components/recruitment/submission-details-modal";
import { SubmissionsCards } from "@/components/recruitment/submissions-list";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useDeleteResource } from "@/hooks/use-resource";
import { recruitmentSubmissionResource } from "@/resources/recruitment-submissions";
import type { RecruitmentCustomField, RecruitmentSubmission } from "@repo/shared/types";

const FormSheet = dynamic(() =>
  import("@/components/forms/form-sheet").then((m) => m.FormSheet),
);

interface SubmissionCardsViewProps {
  rows: RecruitmentSubmission[];
  fields?: RecruitmentCustomField[];
  showRecruitment?: boolean;
  /** Query keys to invalidate after edit/delete */
  invalidateKeys?: string[][];
}

export function SubmissionCardsView({
  rows,
  fields = [],
  showRecruitment = false,
  invalidateKeys = [],
}: SubmissionCardsViewProps) {
  const queryClient = useQueryClient();
  const [viewingItem, setViewingItem] = useState<RecruitmentSubmission | null>(null);
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);
  const [deletingSubmission, setDeletingSubmission] = useState<RecruitmentSubmission | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { mutate: deleteItem, isPending: isDeleting } = useDeleteResource(
    recruitmentSubmissionResource.endpoint,
  );

  const invalidate = useCallback(() => {
    for (const key of invalidateKeys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
    queryClient.invalidateQueries({ queryKey: [recruitmentSubmissionResource.endpoint] });
  }, [queryClient, invalidateKeys]);

  const handleView = (submission: RecruitmentSubmission) => {
    setViewingItem(submission);
  };

  const handleEdit = (submission: RecruitmentSubmission) => {
    setEditingItem(submission as unknown as Record<string, unknown>);
  };

  const handleDelete = (submission: RecruitmentSubmission) => {
    setDeletingSubmission(submission);
    setConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!deletingSubmission) return;
    deleteItem(deletingSubmission.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        setDeletingSubmission(null);
        setViewingItem(null);
        invalidate();
      },
    });
  };

  return (
    <>
      <SubmissionsCards
        rows={rows}
        fields={fields}
        showRecruitment={showRecruitment}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {viewingItem && (
        <SubmissionDetailsModal
          submission={viewingItem}
          fields={fields}
          onClose={() => setViewingItem(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {editingItem && (
        <FormSheet
          resource={recruitmentSubmissionResource}
          item={editingItem}
          onClose={() => {
            setEditingItem(null);
            invalidate();
          }}
        />
      )}

      <ConfirmModal
        open={confirmOpen}
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirmOpen(false);
          setDeletingSubmission(null);
        }}
        title="Delete Recruitment Submission"
        description={
          deletingSubmission
            ? `Yakin ingin menghapus submission dari ${deletingSubmission.name}? Tindakan ini tidak dapat dibatalkan.`
            : "Yakin ingin menghapus submission ini?"
        }
        confirmLabel="Delete"
        variant="danger"
        loading={isDeleting}
      />
    </>
  );
}
