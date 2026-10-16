// Admin membuka/menutup pendaftaran mandiri di halaman login
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const open = (await readBody(event))?.open;
  if (typeof open !== "boolean") throw httpError(400, "Nilai 'open' harus true atau false");
  await setSetting("registration_open", open ? "1" : "0");
  return { ok: true, open };
});
