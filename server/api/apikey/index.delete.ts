export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  await revokeApiKey(user.id);
  return { ok: true };
});
