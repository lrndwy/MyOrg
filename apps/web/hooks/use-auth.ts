"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  User,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  ApiResponse,
} from "@repo/shared/types";
import { apiClient } from "@/lib/api";
import { setTokens, clearTokens } from "@/lib/auth";
import { navigateAfterLogin } from "@/lib/post-login";

// GET /api/me returns the current user with MyOrg relations
// (Division, AppRole) preloaded — richer than /api/auth/me, which is
// why every page in this app (dashboard, profile, navbar) uses this
// hook instead. Mirrors the admin app's useMe convention: 401 resolves
// to `null` instead of throwing, so callers can branch on
// `user === null` without a try/catch.
export function useMe() {
  return useQuery<User | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<ApiResponse<User>>("/api/me");
        return data.data;
      } catch (err: unknown) {
        const e = err as { response?: { status?: number } };
        if (e.response?.status === 401) {
          // Cookie session gone — drop mirrored localStorage tokens so a
          // stale Bearer cannot resurrect the session (admin↔login loop).
          clearTokens();
          return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 60 * 1000,
  });
}

// LoginResult covers both outcomes of POST /api/auth/login: a normal
// sign-in (user + tokens) or a TOTP challenge (totp_required +
// pending_token).
export interface LoginResult {
  totp_required?: boolean;
  pending_token?: string;
  user?: User;
  tokens?: AuthResponse["tokens"];
}

function useNextParam(): string | null {
  const searchParams = useSearchParams();
  return searchParams.get("next");
}

export function useLogin() {
  const queryClient = useQueryClient();
  const next = useNextParam();

  return useMutation<LoginResult, Error, LoginRequest>({
    mutationFn: async (credentials: LoginRequest) => {
      const { data } = await apiClient.post<ApiResponse<LoginResult>>(
        "/api/auth/login",
        credentials
      );
      return data.data;
    },
    onSuccess: (data) => {
      if (data.totp_required) return;
      if (data.user && data.tokens) {
        setTokens(data.tokens);
        queryClient.setQueryData(["me"], data.user);
        navigateAfterLogin(data.user, next);
      }
    },
  });
}

export interface VerifyTotpInput {
  pending_token: string;
  code: string;
  trust_device?: boolean;
}

export function useVerifyTotp() {
  const queryClient = useQueryClient();
  const next = useNextParam();

  return useMutation({
    mutationFn: async (input: VerifyTotpInput) => {
      const { data } = await apiClient.post<ApiResponse<AuthResponse>>(
        "/api/auth/totp/verify",
        input
      );
      return data.data;
    },
    onSuccess: (data) => {
      setTokens(data.tokens);
      queryClient.setQueryData(["me"], data.user);
      navigateAfterLogin(data.user, next);
    },
  });
}

export function useVerifyBackupCode() {
  const queryClient = useQueryClient();
  const next = useNextParam();

  return useMutation({
    mutationFn: async (input: VerifyTotpInput) => {
      const { data } = await apiClient.post<ApiResponse<AuthResponse>>(
        "/api/auth/totp/backup-codes/verify",
        input
      );
      return data.data;
    },
    onSuccess: (data) => {
      setTokens(data.tokens);
      queryClient.setQueryData(["me"], data.user);
      navigateAfterLogin(data.user, next);
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
      return data.data;
    },
    onSuccess: (data) => {
      setTokens(data.tokens);
      queryClient.setQueryData(["me"], data.user);
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
        // The API clears the auth cookies via Set-Cookie max-age=0 even
        // on a non-2xx (e.g. token already expired) — local state still
        // gets wiped by onSettled below, so a failed request is safe to
        // swallow here.
      }
    },
    onSettled: () => {
      clearTokens();
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
  });
}

export interface UpdateMeInput {
  full_name?: string;
  hometown?: string;
  phone?: string;
  avatar?: string;
  birth_date?: string | null;
}

export function useUpdateMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateMeInput) => {
      const { data } = await apiClient.put<ApiResponse<User>>("/api/me", input);
      return data.data;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["me"], user);
    },
  });
}

export interface ChangePasswordInput {
  old_password: string;
  new_password: string;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const { data } = await apiClient.put<{ message: string }>(
        "/api/me/password",
        input
      );
      return data;
    },
  });
}
