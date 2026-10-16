export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const n = Number((await readBody(event))?.saldoAwal);
  if (!Number.isFinite(n) || n < 0 || n > 1e13) throw httpError(400, "Saldo awal tidak valid");
  await setUserSetting(user.id, "saldo_awal", Math.round(n));
  return { ok: true, saldoAwal: Math.round(n) };
});
