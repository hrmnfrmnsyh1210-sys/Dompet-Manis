// Permintaan API yang mengubah data wajib berformat JSON (mencegah CSRF lewat form HTML)
export default defineEventHandler((event) => {
  if (!event.path.startsWith("/api/")) return;
  if (["GET", "HEAD", "OPTIONS"].includes(event.method)) return;
  const len = Number(getHeader(event, "content-length") || 0);
  const type = getHeader(event, "content-type") || "";
  if (len > 0 && !type.includes("application/json")) {
    throw httpError(415, "Content-Type harus application/json");
  }
});
