import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { redirectToWebLogin } from "@/lib/panel-access";

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  email?: string;
  full_name?: string;
  hometown?: string;
  phone?: string;
  birth_date?: string | null;
  avatar?: string;
  password?: string;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const { data: response } = await apiClient.put("/api/profile", data);
      return response;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], data.data);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: { password: string }) => {
      const { data: response } = await apiClient.put("/api/profile", data);
      return response;
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.delete("/api/profile");
    },
    onSuccess: () => {
      queryClient.clear();
      redirectToWebLogin({ fromLogout: true });
    },
  });
}
