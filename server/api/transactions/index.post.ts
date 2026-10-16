export default defineEventHandler(async (event) => {
  const { userId, via } = await requireUserOrApi(event);
  const body = (await readBody(event)) ?? {};
  const t = await validateTrx(userId, body);
  // Sumber: web, atau label dari bot (mis. "telegram")
  const source = via === "api" ? String(body.source || "api").slice(0, 20) : "web";
  const r = await execute(
    "INSERT INTO transactions (user_id, type, date, category_id, amount, note, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [userId, t.type, t.date, t.category_id, t.amount, t.note, source, Date.now()],
  );
  setResponseStatus(event, 201);
  return { transaction: await getTrx(userId, r.insertId), summary: await summary(userId, t.date.slice(0, 7)) };
});
