// Ikon kategori (set MingCute). Disimpan di database sebagai "key" pendek.
export const CATEGORY_ICONS = {
  // pemasukan & uang
  briefcase: "mingcute:briefcase-line",
  wallet: "mingcute:wallet-4-line",
  coin: "mingcute:coin-line",
  cash: "mingcute:cash-line",
  bank: "mingcute:bank-line",
  receive: "mingcute:receive-money-line",
  growth: "mingcute:trending-up-line",
  store: "mingcute:store-2-line",
  gift: "mingcute:gift-line",
  heart: "mingcute:heart-line",
  bow: "mingcute:bowknot-line",
  diamond: "mingcute:diamond-line",
  // makan & minum
  food: "mingcute:fork-spoon-line",
  bowl: "mingcute:bowl-2-line",
  cake: "mingcute:cupcake-line",
  drink: "mingcute:teacup-line",
  // cantik & belanja
  lipstick: "mingcute:lipstick-line",
  dress: "mingcute:dress-line",
  skirt: "mingcute:skirt-line",
  bag: "mingcute:shopping-bag-1-line",
  cart: "mingcute:shopping-cart-1-line",
  // transportasi & rumah
  car: "mingcute:car-line",
  scooter: "mingcute:scooter-line",
  bus: "mingcute:bus-line",
  plane: "mingcute:airplane-line",
  fuel: "mingcute:gas-station-line",
  home: "mingcute:home-4-line",
  bill: "mingcute:bill-line",
  bulb: "mingcute:bulb-line",
  phone: "mingcute:cellphone-line",
  wifi: "mingcute:wifi-line",
  // hiburan, kesehatan, belajar
  film: "mingcute:film-line",
  ticket: "mingcute:ticket-line",
  game: "mingcute:game-2-line",
  music: "mingcute:music-2-line",
  health: "mingcute:first-aid-kit-line",
  heartbeat: "mingcute:heartbeat-line",
  book: "mingcute:book-2-line",
  school: "mingcute:school-line",
  // lain-lain
  charity: "mingcute:hand-heart-line",
  piggy: "mingcute:pig-money-line",
  cat: "mingcute:cat-line",
  dog: "mingcute:dog-line",
  rabbit: "mingcute:rabbit-line",
  flower: "mingcute:flower-line",
  leaf: "mingcute:leaf-line",
  star: "mingcute:star-line",
  sparkles: "mingcute:sparkles-line",
} as const;

export type IconKey = keyof typeof CATEGORY_ICONS;
export const ICON_KEYS = Object.keys(CATEGORY_ICONS) as IconKey[];
export const DEFAULT_ICON: IconKey = "sparkles";

export const isIconKey = (k: unknown): k is IconKey => typeof k === "string" && k in CATEGORY_ICONS;
export const iconName = (k: string) => CATEGORY_ICONS[isIconKey(k) ? k : DEFAULT_ICON];

/** Warna pastel tetap per ikon, supaya tiap kategori punya "warna"-nya sendiri */
const TONES = ["pink", "mint", "sky", "blush"] as const;
export type Tone = (typeof TONES)[number];
export function toneOf(k: string): Tone {
  let h = 0;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length]!;
}
