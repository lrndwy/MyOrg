import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type {
  User,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  ApiResponse,
} from "@repo/shared/types";
import { apiClient } from "@/lib/api-client";
import {
  ADMIN_ACCESS_DENIED_MESSAGE,
  canAccessAdminPanel,
  getWebAppUrl,
  redirectToWebLogin,
} from "@/lib/panel-access";

// Auth flow (Grit 3.27+):
//   - User shape lives in packages/shared/types/user.ts (the SAME type
//     the Go API serialises and the web app imports). Never inline it.
//   - Login / register / OAuth set HttpOnly grit_access + grit_refresh
//     cookies via Set-Cookie. The browser stores them; JS never reads.
//   - apiClient has withCredentials: true so the cookies are attached
//     automatically on every request.
//   - useMe returns null on 401 instead of throwing so guard components
//     can read user === null cleanly without a try/catch.
//   - useLogout posts to /api/auth/logout — the API clears the cookies
//     via Set-Cookie max-age=0; we just clear the query cache + redirect.
//   - Panel Access USER is rejected from this app entirely (ADMIN/EDITOR only).

async function rejectUserPanelAccess(user: User) {
  if (canAccessAdminPanel(user.role)) return;
  // Clear cookies so a USER session opened via admin login doesn't linger.
  try {
    await apiClient.post("/api/auth/logout");
  } catch {
    // ignore — still reject access below
  }
  const err = new Error(ADMIN_ACCESS_DENIED_MESSAGE) as Error & {
    response?: { data?: { error?: { message?: string } } };
  };
  err.response = {
    data: { error: { message: ADMIN_ACCESS_DENIED_MESSAGE } },
  };
  throw err;
}

export function useMe() {
  return useQuery<User | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<ApiResponse<User>>("/api/auth/me");
        return data.data;
      } catch (err: unknown) {
        const e = err as { response?: { status?: number } };
        if (e.response?.status === 401) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: 10 * 60 * 1000,
  });
}

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      // POST is enough — the API responds with Set-Cookie headers for
      // grit_access + grit_refresh. The 'tokens' field in the JSON body
      // is preserved for native bearer clients (mobile/desktop); the
      // browser ignores it.
      const { data } = await apiClient.post<ApiResponse<AuthResponse>>(
        "/api/auth/login",
        credentials
      );
      await rejectUserPanelAccess(data.data.user);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], data.data.user);
      router.push("/dashboard");
    },
  });
}

export function useRegister() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegisterRequest) => {
      const { data } = await apiClient.post<ApiResponse<AuthResponse>>(
        "/api/auth/register",
        payload
      );
      await rejectUserPanelAccess(data.data.user);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], data.data.user);
      router.push("/dashboard");
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await apiClient.post("/api/auth/logout");
      } catch {
        // The API clears the cookies via Set-Cookie max-age=0 even on
        // a 4xx, so falling through here is safe — local state still
        // gets wiped by onSettled.
      }
    },
    onSettled: () => {
      queryClient.clear();
      // No `next` — returning to admin dashboard after logout caused a
      // redirect loop while web still held a mirrored Bearer token.
      redirectToWebLogin({ fromLogout: true });
    },
  });
}

/** Send Panel Access USER back to the public web app. */
export function redirectUserAwayFromAdmin() {
  if (typeof window !== "undefined") {
    window.location.href = `${getWebAppUrl()}/dashboard`;
  }
}
