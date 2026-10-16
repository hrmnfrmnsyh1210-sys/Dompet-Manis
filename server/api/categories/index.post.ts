export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = await readBody(event);
  if (!TYPES.includes(body?.type)) throw httpError(400, "Jenis kategori tidak valid");
  const { name, icon } = validateCategory(body);
  const { s } = (await queryOne<{ s: number }>(
    "SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM categories WHERE user_id = ? AND type = ?",
    [user.id, body.type],
  ))!;
  try {
    const r = await execute(
      "INSERT INTO categories (user_id, type, name, icon, sort) VALUES (?, ?, ?, ?, ?)",
      [user.id, body.type, name, icon, s],
    );
    setResponseStatus(event, 201);
    return getCategory(user.id, r.insertId);
  } catch (e) {
    if (isDuplicateError(e)) throw httpError(409, "Nama kategori sudah ada");
    throw e;
  }
});
