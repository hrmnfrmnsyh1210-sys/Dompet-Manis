// Laporan: data sesuai filter + ekspor PDF & Excel
import type { Category, Trx, TrxType } from "~/composables/useFinance";

export type ReportFilter = { month: string; type: "all" | TrxType; q: string };
export type ReportRow = Trx & { category: string; icon: string; balance: number };

export type Report = {
  filter: ReportFilter;
  rows: ReportRow[];
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  categories: { cat: Category; total: number }[]; // pengeluaran per kategori di periode
};

export function buildReport(
  saldoAwal: number,
  trx: Trx[],
  catById: (id: number) => Category,
  filter: ReportFilter,
): Report {
  const { month, type } = filter;
  const q = filter.q.trim().toLowerCase();
  const before = month === "all" ? [] : trx.filter((t) => t.date.slice(0, 7) < month);
  const inPeriod = month === "all" ? trx : trx.filter((t) => t.date.slice(0, 7) === month);
  const opening = saldoAwal + before.reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);

  let running = opening;
  let totalIn = 0;
  let totalOut = 0;
  const rows: ReportRow[] = [];
  const perCat = new Map<number, number>();

  for (const t of inPeriod) {
    running += t.type === "in" ? t.amount : -t.amount;
    if (t.type === "in") totalIn += t.amount;
    else {
      totalOut += t.amount;
      perCat.set(t.category_id, (perCat.get(t.category_id) ?? 0) + t.amount);
    }
    const cat = catById(t.category_id);
    const matchType = type === "all" || t.type === type;
    const matchQ = !q || cat.name.toLowerCase().includes(q) || t.note.toLowerCase().includes(q);
    if (matchType && matchQ) rows.push({ ...t, category: cat.name, icon: cat.icon, balance: running });
  }

  const categories = [...perCat.entries()]
    .map(([id, total]) => ({ cat: catById(id), total }))
    .sort((a, b) => b.total - a.total);

  return { filter, rows, opening, totalIn, totalOut, closing: opening + totalIn - totalOut, categories };
}

function filterDesc(f: ReportFilter) {
  const parts = [`Periode: ${monthLabel(f.month)}`];
  if (f.type !== "all") parts.push(`Jenis: ${f.type === "in" ? "Pemasukan" : "Pengeluaran"}`);
  if (f.q.trim()) parts.push(`Pencarian: "${f.q.trim()}"`);
  return parts.join("  |  ");
}

const fileName = (f: ReportFilter, ext: string) => `laporan-keuangan-${f.month === "all" ? "semua" : f.month}.${ext}`;
const sumType = (rows: ReportRow[], type: TrxType) => rows.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);

// Warna laporan (selaras tema)
const PINK: [number, number, number] = [232, 135, 159];
const SOFT: [number, number, number] = [251, 227, 234];
const INK: [number, number, number] = [54, 48, 58];
const BLUE: [number, number, number] = [59, 122, 181];
const ROSE: [number, number, number] = [214, 61, 120];

// ---------- PDF ----------
export async function exportPdf(r: Report) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PINK);
  doc.roundedRect(10, 10, W - 20, 28, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Laporan Keuangan - Dompet Manis", 16, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(filterDesc(r.filter), 16, 30);
  doc.text(`Dicetak: ${formatDate(todayISO())}`, W - 16, 30, { align: "right" });

  const boxes: [string, number, [number, number, number]][] = [
    ["Saldo Awal", r.opening, INK],
    ["Pemasukan", r.totalIn, BLUE],
    ["Pengeluaran", r.totalOut, ROSE],
    ["Saldo Akhir", r.closing, INK],
  ];
  const bw = (W - 20 - 9) / 4;
  boxes.forEach(([label, val, color], i) => {
    const x = 10 + i * (bw + 3);
    doc.setFillColor(...SOFT);
    doc.roundedRect(x, 44, bw, 20, 3, 3, "F");
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(label, x + 4, 51);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(rupiah(val), x + 4, 59);
  });

  const body = r.rows.map((t, i) => [
    i + 1,
    formatDate(t.date),
    t.type === "in" ? "Pemasukan" : "Pengeluaran",
    t.category,
    t.note || "-",
    t.type === "in" ? rupiah(t.amount) : "",
    t.type === "out" ? rupiah(t.amount) : "",
    rupiah(t.balance),
  ]);

  const tableStyle = {
    theme: "grid" as const,
    margin: { left: 10, right: 10 },
    styles: { fontSize: 8, textColor: INK, lineColor: [246, 197, 211] as [number, number, number], lineWidth: 0.2, cellPadding: 2 },
    headStyles: { fillColor: PINK, textColor: 255, fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [253, 245, 247] as [number, number, number] },
  };

  autoTable(doc, {
    ...tableStyle,
    startY: 70,
    head: [["No", "Tanggal", "Jenis", "Kategori", "Keterangan", "Masuk", "Keluar", "Saldo"]],
    body: body.length ? body : [[{ content: "Tidak ada transaksi", colSpan: 8, styles: { halign: "center" } }]],
    foot: body.length ? [["", "", "", "", "Total", rupiah(sumType(r.rows, "in")), rupiah(sumType(r.rows, "out")), ""]] : undefined,
    footStyles: { fillColor: SOFT, textColor: INK, fontStyle: "bold" },
    columnStyles: {
      0: { halign: "center", cellWidth: 9 },
      1: { cellWidth: 20 },
      5: { halign: "right", textColor: BLUE },
      6: { halign: "right", textColor: ROSE },
      7: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "foot" && data.column.index >= 5) data.cell.styles.halign = "right";
    },
  });

  if (r.categories.length) {
    autoTable(doc, {
      ...tableStyle,
      startY: ((doc as any).lastAutoTable?.finalY ?? 70) + 8,
      head: [["Kategori Pengeluaran", "Jumlah", "Persentase"]],
      body: r.categories.map(({ cat, total }) => [cat.name, rupiah(total), ((total / r.totalOut) * 100).toFixed(1) + "%"]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });
  }

  const pages = doc.getNumberOfPages();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(196, 154, 169);
    doc.text("Dompet Manis - catat keuanganmu dengan hati", 10, H - 8);
    doc.text(`Halaman ${i} / ${pages}`, W - 10, H - 8, { align: "right" });
  }

  doc.save(fileName(r.filter, "pdf"));
}

// ---------- Excel ----------
export async function exportExcel(r: Report) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dompet Manis";
  wb.created = new Date();

  const RP = '"Rp" #,##0;[Red]-"Rp" #,##0';
  const hex = (c: [number, number, number]) => "FF" + c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  const fill = (c: [number, number, number]) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: hex(c) } });
  const border = { style: "thin" as const, color: { argb: "FFF6C5D3" } };
  const borders = { top: border, left: border, bottom: border, right: border };

  // Sheet 1: Transaksi
  const ws = wb.addWorksheet("Transaksi", { views: [{ state: "frozen", ySplit: 10 }] });
  ws.columns = [
    { width: 6 }, { width: 13 }, { width: 14 }, { width: 22 }, { width: 36 }, { width: 16 }, { width: 16 }, { width: 17 },
  ];

  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = "LAPORAN KEUANGAN - DOMPET MANIS";
  ws.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  ws.getCell("A1").fill = fill(PINK);
  ws.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:H2");
  ws.getCell("A2").value = filterDesc(r.filter);
  ws.mergeCells("A3:H3");
  ws.getCell("A3").value = `Dicetak: ${formatDate(todayISO())}`;
  ["A2", "A3"].forEach((a) => {
    ws.getCell(a).font = { italic: true, color: { argb: hex(INK) } };
    ws.getCell(a).alignment = { horizontal: "center" };
  });

  const summary: [string, number, [number, number, number]][] = [
    ["Saldo Awal", r.opening, INK],
    ["Total Pemasukan", r.totalIn, BLUE],
    ["Total Pengeluaran", r.totalOut, ROSE],
    ["Saldo Akhir", r.closing, INK],
  ];
  summary.forEach(([label, val, color], i) => {
    const row = ws.getRow(5 + i);
    row.getCell(2).value = label;
    row.getCell(4).value = val;
    ws.mergeCells(5 + i, 2, 5 + i, 3);
    row.getCell(2).font = { bold: true, color: { argb: hex(INK) } };
    row.getCell(4).numFmt = RP;
    row.getCell(4).font = { bold: true, color: { argb: hex(color) } };
    [2, 3, 4].forEach((c) => {
      row.getCell(c).fill = fill(SOFT);
      row.getCell(c).border = borders;
    });
  });

  const header = ws.getRow(10);
  header.values = ["No", "Tanggal", "Jenis", "Kategori", "Keterangan", "Pemasukan", "Pengeluaran", "Saldo"];
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = fill(PINK);
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = borders;
  });

  r.rows.forEach((t, i) => {
    const row = ws.addRow([
      i + 1, formatDate(t.date), t.type === "in" ? "Pemasukan" : "Pengeluaran", t.category, t.note || "-",
      t.type === "in" ? t.amount : null, t.type === "out" ? t.amount : null, t.balance,
    ]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = borders;
      if (i % 2 === 1) cell.fill = fill([253, 245, 247]);
      if (col >= 6) cell.numFmt = RP;
    });
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(6).font = { color: { argb: hex(BLUE) } };
    row.getCell(7).font = { color: { argb: hex(ROSE) } };
  });

  if (r.rows.length) {
    const total = ws.addRow(["", "", "", "", "TOTAL", sumType(r.rows, "in"), sumType(r.rows, "out"), null]);
    total.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { bold: true, color: { argb: hex(INK) } };
      cell.fill = fill(SOFT);
      cell.border = borders;
      if (col >= 6) cell.numFmt = RP;
    });
  }

  // Sheet 2: Rekap kategori
  const ws2 = wb.addWorksheet("Rekap Kategori");
  ws2.columns = [{ width: 26 }, { width: 18 }, { width: 14 }];
  const h2 = ws2.addRow(["Kategori Pengeluaran", "Jumlah", "Persentase"]);
  h2.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = fill(PINK);
    cell.border = borders;
  });
  r.categories.forEach(({ cat, total }) => {
    const row = ws2.addRow([cat.name, total, r.totalOut ? total / r.totalOut : 0]);
    row.getCell(2).numFmt = RP;
    row.getCell(3).numFmt = "0.0%";
    row.eachCell((cell) => (cell.border = borders));
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName(r.filter, "xlsx");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
