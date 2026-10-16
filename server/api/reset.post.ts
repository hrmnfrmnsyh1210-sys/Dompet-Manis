// Hapus semua transaksi milik pengguna ini (butuh konfirmasi password)
export default defineEventHandler(async (event) => {
  const me = await requireUser(event);
  const user = (await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", [me.id]))!;
  if (!(await verifyPassword(String((await readBody(event))?.password ?? ""), user.password_hash)))
    throw httpError(400, "Password salah");
  await withTransaction(async (tx) => {
    await execute("DELETE FROM transactions WHERE user_id = ?", [me.id], tx);
    await setUserSetting(me.id, "saldo_awal", 0, tx);
  });
  return { ok: true };
});
