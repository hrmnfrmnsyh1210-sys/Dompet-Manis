// Ringkasan saldo — dipakai juga oleh bot ("saldoku berapa?")
export default defineEventHandler(async (event) => {
  const { userId } = await requireUserOrApi(event);
  const month = String(getQuery(event).month || todayISO().slice(0, 7));
  if (!MONTH_RE.test(month)) throw httpError(400, "Format bulan harus YYYY-MM");
  return summary(userId, month);
});
