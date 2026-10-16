// Buat (ulang) API key milik pengguna ini — key lama otomatis tidak berlaku
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  return { key: await generateApiKey(user.id) };
});
