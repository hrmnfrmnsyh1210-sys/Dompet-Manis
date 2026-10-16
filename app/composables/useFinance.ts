export type TrxType = "in" | "out";
export type Category = { id: number; type: TrxType; name: string; icon: string; sort: number; used: number };
export type Trx = {
  id: number; type: TrxType; date: string; category_id: number;
  amount: number; note: string; source: string; created_at: number;
};

const FALLBACK_CAT: Category = { id: 0, type: "out", name: "?", icon: "sparkles", sort: 0, used: 0 };

export function useFinance() {
  const fin = useState("finance", () => ({
    loaded: false,
    username: "",
    role: "user" as "admin" | "user",
    saldoAwal: 0,
    categories: [] as Category[],
    trx: [] as Trx[], // urut naik berdasarkan tanggal
  }));

  async function load() {
    const s = await api<{ username: string; role: "admin" | "user"; saldoAwal: number; categories: Category[]; transactions: Trx[] }>("/api/state");
    fin.value = { loaded: true, username: s.username, role: s.role, saldoAwal: s.saldoAwal, categories: s.categories, trx: s.transactions };
  }

  const catById = (id: number) => fin.value.categories.find((c) => c.id === id) ?? FALLBACK_CAT;
  const catsOf = (type: TrxType) => fin.value.categories.filter((c) => c.type === type);

  const totals = computed(() => {
    const month = thisMonth();
    let tin = 0, tout = 0, min = 0, mout = 0;
    for (const t of fin.value.trx) {
      const inMonth = t.date.startsWith(month);
      if (t.type === "in") { tin += t.amount; if (inMonth) min += t.amount; }
      else { tout += t.amount; if (inMonth) mout += t.amount; }
    }
    return { saldo: fin.value.saldoAwal + tin - tout, totalIn: tin, totalOut: tout, monthIn: min, monthOut: mout };
  });

  return { fin, load, catById, catsOf, totals };
}

// ---------- Modal global ----------
export const useTrxModal = () =>
  useState("trxModal", () => ({ open: false, editId: null as number | null, type: "out" as TrxType }));

export const useSaldoModal = () => useState("saldoModal", () => false);
