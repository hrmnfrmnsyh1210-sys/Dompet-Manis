export const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];

export function rupiah(n: number) {
  const sign = n < 0 ? "-" : "";
  return sign + "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
}

/** Pecah angka jadi bagian tebal + ekor tipis, mis. "1.575" + ".000" */
export function moneyParts(n: number) {
  const abs = Math.abs(Math.round(n)).toLocaleString("id-ID");
  const i = abs.lastIndexOf(".");
  return i > 0 ? { head: abs.slice(0, i), tail: abs.slice(i) } : { head: abs, tail: "" };
}

export function parseAmount(str: string | number) {
  return Number(String(str).replace(/[^\d]/g, "")) || 0;
}

export function formatThousands(str: string) {
  const n = parseAmount(str);
  return n ? n.toLocaleString("id-ID") : "";
}

export function formatDate(iso: string, withYear = true) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${BULAN[Number(m) - 1]!.slice(0, 3)}${withYear ? " " + y : ""}`;
}

export function monthLabel(key: string) {
  if (key === "all") return "Semua Waktu";
  const [y, m] = key.split("-");
  return `${BULAN[Number(m) - 1]} ${y}`;
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const todayISO = () => toISODate(new Date());
export const thisMonth = () => todayISO().slice(0, 7);

export function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
}
