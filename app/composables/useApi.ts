type AuthStatus = { setupRequired: boolean; registrationOpen: boolean; loggedIn: boolean; username: string | null; role: "admin" | "user" | null };

export const useAuthStatus = () => useState<AuthStatus | null>("auth", () => null);

/** $fetch dengan pesan error yang ramah & redirect ke login saat sesi habis */
export async function api<T = any>(url: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
  try {
    return (await $fetch(url, opts as any)) as T;
  } catch (e: any) {
    const status = e?.statusCode ?? e?.response?.status;
    if (status === 401 && !url.startsWith("/api/auth/")) {
      useAuthStatus().value = null;
      await navigateTo("/login");
    }
    const err = new Error(e?.data?.message || e?.data?.statusMessage || "Tidak bisa terhubung ke server") as Error & { status?: number; data?: any };
    err.status = status;
    err.data = e?.data?.data;
    throw err;
  }
}
