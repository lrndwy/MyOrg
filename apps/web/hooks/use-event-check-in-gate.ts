"use client";

import { useMemo } from "react";
import { useMyEventAttendance } from "@/hooks/use-attendances";
import { useMyPermissionRequests } from "@/hooks/use-permission-requests";

/** Active leave request that blocks both Absen and Ajukan Izin. */
export function isBlockingPermissionStatus(status: string | undefined | null) {
  return status === "pending" || status === "approved";
}

/**
 * Shared gate for event check-in / leave:
 * - already absen → cannot absen or izin again
 * - already izin (pending/approved) → cannot absen or izin again
 */
export function useEventCheckInGate(eventId: string) {
  const {
    data: attendance,
    isLoading: attendanceLoading,
    isError: attendanceError,
  } = useMyEventAttendance(eventId);
  const {
    data: permissions,
    isLoading: permissionsLoading,
  } = useMyPermissionRequests();

  const activePermission = useMemo(() => {
    if (!eventId) return null;
    return (
      (permissions || []).find(
        (r) => r.event_id === eventId && isBlockingPermissionStatus(r.status)
      ) || null
    );
  }, [permissions, eventId]);

  const hasAttendance = !!attendance;
  const hasActivePermission = !!activePermission;
  const alreadyParticipated = hasAttendance || hasActivePermission;

  return {
    attendance: attendance ?? null,
    activePermission,
    hasAttendance,
    hasActivePermission,
    alreadyParticipated,
    /** Absen only when not yet attended and no active izin. */
    canSubmitAttendance: !alreadyParticipated,
    /** Izin only when not yet attended and no active izin. */
    canSubmitPermission: !alreadyParticipated,
    isLoading: attendanceLoading || permissionsLoading,
    // 404 for attendance is expected (null) — useMyEventAttendance maps it to null
    attendanceError,
  };
}
