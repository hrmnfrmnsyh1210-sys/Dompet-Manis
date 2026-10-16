export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = parseId(getRouterParam(event, "id"));
  const { name, icon } = validateCategory(await readBody(event));
  if (!(await getCategory(user.id, id))) throw httpError(404, "Kategori tidak ditemukan");
  try {
    await execute("UPDATE categories SET name = ?, icon = ? WHERE id = ? AND user_id = ?", [name, icon, id, user.id]);
  } catch (e) {
    if (isDuplicateError(e)) throw httpError(409, "Nama kategori sudah ada");
    throw e;
  }
  return getCategory(user.id, id);
});
