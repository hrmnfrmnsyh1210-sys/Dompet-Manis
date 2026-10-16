// Semua halaman (kecuali /login) wajib login. Data tetap dilindungi di sisi API.
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStatus();
  if (!auth.value) {
    try {
      auth.value = await $fetch("/api/auth/status");
    } catch {
      auth.value = { setupRequired: false, registrationOpen: false, loggedIn: false, username: null, role: null };
    }
  }
  if (to.path === "/login") {
    if (auth.value!.loggedIn) return navigateTo("/");
    return;
  }
  if (!auth.value!.loggedIn) return navigateTo("/login");
  // Halaman pengelolaan pengguna khusus admin (server juga menolak non-admin)
  if (to.path.startsWith("/pengguna") && auth.value!.role !== "admin") return navigateTo("/");
});
