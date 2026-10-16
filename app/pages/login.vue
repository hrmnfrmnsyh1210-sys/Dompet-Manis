<script setup lang="ts">
definePageMeta({ layout: false });

const auth = useAuthStatus();
// setup = akun admin pertama, register = pendaftaran mandiri, login = masuk biasa
// /login?daftar langsung membuka tab Daftar (enak untuk dibagikan)
const registering = ref(useRoute().query.daftar !== undefined);
const mode = computed(() => (auth.value?.setupRequired ? "setup" : registering.value && auth.value?.registrationOpen ? "register" : "login"));
const newAccount = computed(() => mode.value !== "login");
useHead({ title: () => (mode.value === "login" ? "Masuk · Dompet Manis" : "Daftar · Dompet Manis") });

const heading = computed(() => ({
  setup: { title: "Siapkan akun admin", sub: "Akun pertama ini otomatis menjadi admin aplikasi" },
  register: { title: "Buat akun baru", sub: "Gratis, cukup username dan password" },
  login: { title: "Selamat datang kembali", sub: "Masuk dulu yuk untuk melihat dompetmu" },
}[mode.value]));

const form = reactive({ username: "", password: "", password2: "", remember: false });
const showPw = ref(false);
const error = ref("");
const loading = ref(false);
const success = ref(false);
const shake = ref(false);
const capsLock = ref(false);
const focused = ref<"user" | "pw" | null>(null);

const usernameOk = computed(() => /^[a-zA-Z0-9_.]{3,30}$/.test(form.username.trim()));

// Kekuatan password: 0-4 (hanya ditampilkan saat membuat akun)
const strength = computed(() => {
  const p = form.password;
  if (!p) return 0;
  let s = p.length >= 8 ? 1 : 0;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
});
const strengthLabel = computed(() => ["Terlalu pendek", "Lemah", "Cukup", "Kuat", "Sangat kuat"][strength.value]);
const pwMismatch = computed(() => newAccount.value && !!form.password2 && form.password !== form.password2);

function checkCaps(e: KeyboardEvent) {
  capsLock.value = e.getModifierState?.("CapsLock") ?? false;
}

function switchMode(reg: boolean) {
  registering.value = reg;
  error.value = "";
  form.password = form.password2 = "";
}

async function submit() {
  error.value = "";
  if (newAccount.value) {
    if (form.password.length < 8) return fail("Password minimal 8 karakter ya");
    if (form.password !== form.password2) return fail("Password tidak sama");
  }
  loading.value = true;
  try {
    const url = { setup: "/api/auth/setup", register: "/api/auth/register", login: "/api/auth/login" }[mode.value];
    await api(url, {
      method: "POST",
      body: { username: form.username.trim(), password: form.password, remember: form.remember },
    });
    success.value = true;
    await new Promise((r) => setTimeout(r, 650)); // biar animasi "berhasil" sempat terlihat
    auth.value = null; // muat ulang status di middleware
    await navigateTo("/");
  } catch (e) {
    form.password = form.password2 = "";
    fail((e as Error).message);
  } finally {
    loading.value = false;
  }
}

function fail(msg: string) {
  error.value = msg;
  shake.value = false;
  requestAnimationFrame(() => (shake.value = true));
}

// ---------- Maskot: mata mengikuti kursor / ketikan, tutup mata saat password diketik ----------
const mascot = ref<HTMLElement | null>(null);
const pointer = reactive({ x: 0, y: 0 });
// Menutup mata selama password diisi (atau sudah terisi dan tersembunyi).
// Begitu ikon mata di kolom password diklik, tangannya turun dan matanya terbuka lebar.
const pwActive = computed(() => focused.value === "pw" || (focused.value !== "user" && !!(form.password || form.password2)));
const covering = computed(() => pwActive.value && !showPw.value);
const peeking = computed(() => pwActive.value && showPw.value);
const look = computed(() => {
  if (focused.value === "user") {
    const t = Math.min(form.username.length, 24) / 24;
    return { x: -4 + t * 8, y: 3 };
  }
  if (peeking.value) return { x: 0, y: 3 }; // melirik ke kolom password
  return pointer;
});

function onPointer(e: PointerEvent) {
  const el = mascot.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, d / 220);
  pointer.x = (dx / d) * 4 * k;
  pointer.y = (dy / d) * 3 * k;
}

// ---------- Panel kiri: parallax, saldo menghitung naik, grafik, transaksi bergantian ----------
const tilt = reactive({ x: 0, y: 0 });
function onHeroMove(e: PointerEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  tilt.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
  tilt.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
}
function onHeroLeave() {
  tilt.x = tilt.y = 0;
}

const SALDO = 4_250_000;
const saldo = ref(0);
const saldoParts = computed(() => moneyParts(saldo.value));
const grown = ref(false);

// Grafik hiasan (bukan data asli): [pemasukan, pengeluaran] dalam ribu rupiah
const bars = [[840, 600], [1160, 920], [1000, 1240], [1440, 800], [1280, 1040], [1720, 960]];
const barMax = 1800;
const hoverBar = ref<number | null>(null);

const samples = [
  { icon: "mingcute:bowl-2-line", tone: "pink", name: "Makan & Minum", amount: -25_000 },
  { icon: "mingcute:briefcase-line", tone: "sky", name: "Gaji", amount: 3_000_000 },
  { icon: "mingcute:car-line", tone: "blush", name: "Transportasi", amount: -15_000 },
  { icon: "mingcute:gift-line", tone: "mint", name: "Bonus", amount: 500_000 },
  { icon: "mingcute:shopping-bag-1-line", tone: "pink", name: "Belanja", amount: -120_000 },
  { icon: "mingcute:store-line", tone: "sky", name: "Jualan", amount: 250_000 },
];
const sampleIdx = ref(0);
const chipA = computed(() => samples[sampleIdx.value % samples.length]!);
const chipB = computed(() => samples[(sampleIdx.value + 3) % samples.length]!);
const fmtSigned = (n: number) => (n < 0 ? "-" : "+") + rupiah(Math.abs(n)).replace(" ", "");

let timer: ReturnType<typeof setInterval> | undefined;
let raf = 0;
onMounted(() => {
  window.addEventListener("pointermove", onPointer, { passive: true });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => (grown.value = true));
  if (reduce) {
    saldo.value = SALDO;
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / 1400);
    saldo.value = Math.round(SALDO * (1 - Math.pow(1 - t, 3)) / 1000) * 1000;
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  timer = setInterval(() => sampleIdx.value++, 3200);
});
onBeforeUnmount(() => {
  window.removeEventListener("pointermove", onPointer);
  clearInterval(timer);
  cancelAnimationFrame(raf);
});

const features = [
  { icon: "mingcute:lightning-line", tone: "pink", text: "Catat pemasukan & pengeluaran dalam hitungan detik" },
  { icon: "mingcute:chart-bar-line", tone: "sky", text: "Grafik arus kas & laporan PDF / Excel" },
  { icon: "mingcute:safe-lock-line", tone: "mint", text: "Data tiap akun aman & terpisah" },
];
</script>

<template>
  <div class="auth-page">
    <!-- Panel kiri: perkenalan aplikasi (disembunyikan di layar kecil) -->
    <section class="auth-hero" :style="{ '--tx': tilt.x, '--ty': tilt.y }" @pointermove="onHeroMove" @pointerleave="onHeroLeave">
      <div class="hero-brand"><span class="hero-logo"><Icon name="mingcute:bowknot-fill" /></span> Dompet Manis</div>

      <div class="hero-copy">
        <h2>Atur uangmu,<br /><span class="grad-text">tenangkan hatimu.</span></h2>
        <p>Catatan keuangan pribadi yang manis, ringan, dan bisa dibuka kapan saja dari HP maupun laptop.</p>
      </div>

      <div class="hero-preview" aria-hidden="true">
        <div class="hp-layer l-saldo" style="--d: 18px">
          <div class="hp-card hp-saldo">
            <span class="hp-label"><Icon name="mingcute:wallet-4-line" /> Saldo kamu</span>
            <b class="hp-amount">Rp{{ saldoParts.head }}<small>{{ saldoParts.tail }}</small></b>
            <span class="hp-trend"><Icon name="mingcute:arrow-right-up-line" /> +12% bulan ini</span>
          </div>
        </div>

        <div class="hp-layer l-chart" style="--d: 28px">
          <div class="hp-card hp-chart">
            <span class="hp-label">Arus kas mingguan</span>
            <div class="hp-bars" :class="{ dim: hoverBar !== null }" @pointerleave="hoverBar = null">
              <div
                v-for="(b, i) in bars" :key="i" class="hp-pair" :class="{ on: hoverBar === i }"
                @pointerenter="hoverBar = i"
              >
                <i class="in" :style="{ height: grown ? (b[0]! / barMax) * 100 + '%' : '0%', transitionDelay: i * 60 + 'ms' }" />
                <i class="out" :style="{ height: grown ? (b[1]! / barMax) * 100 + '%' : '0%', transitionDelay: i * 60 + 30 + 'ms' }" />
              </div>
              <div v-if="hoverBar !== null" class="hp-tip" :style="{ left: ((hoverBar + 0.5) / bars.length) * 100 + '%' }">
                <b>Minggu {{ hoverBar + 1 }}</b>
                <span class="in">+{{ rupiah(bars[hoverBar]![0]! * 1000).replace(" ", "") }}</span>
                <span class="out">-{{ rupiah(bars[hoverBar]![1]! * 1000).replace(" ", "") }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="hp-layer l-chip1" style="--d: 40px">
          <Transition name="chip" mode="out-in">
            <div :key="chipA.name" class="hp-chip">
              <span :class="`tone-${chipA.tone}`"><Icon :name="chipA.icon" /></span> {{ chipA.name }}
              <b :class="chipA.amount < 0 ? 'out' : 'in'">{{ fmtSigned(chipA.amount) }}</b>
            </div>
          </Transition>
        </div>
        <div class="hp-layer l-chip2" style="--d: 52px">
          <Transition name="chip" mode="out-in">
            <div :key="chipB.name" class="hp-chip">
              <span :class="`tone-${chipB.tone}`"><Icon :name="chipB.icon" /></span> {{ chipB.name }}
              <b :class="chipB.amount < 0 ? 'out' : 'in'">{{ fmtSigned(chipB.amount) }}</b>
            </div>
          </Transition>
        </div>
      </div>

      <ul class="hero-features">
        <li v-for="f in features" :key="f.text"><span :class="`tone-${f.tone}`"><Icon :name="f.icon" /></span>{{ f.text }}</li>
      </ul>
    </section>

    <!-- Panel kanan: form -->
    <main class="auth-panel">
      <div class="auth-bg" aria-hidden="true"><div class="auth-blob b1" /><div class="auth-blob b2" /></div>

      <div class="auth-card">
        <div class="auth-head">
          <div
            ref="mascot" class="mascot" aria-hidden="true"
            :class="{ cover: covering, peek: peeking, sad: !!error && !focused, happy: success }"
            :style="{ '--lx': look.x + 'px', '--ly': look.y + 'px' }"
          >
            <span class="ear l" /><span class="ear r" />
            <div class="face">
              <span class="eye l"><i /></span><span class="eye r"><i /></span>
              <span class="cheek l" /><span class="cheek r" />
              <span class="nose" />
              <span class="mouth" />
            </div>
            <span class="paw l" /><span class="paw r" />
          </div>
          <Transition name="fade" mode="out-in">
            <div :key="mode">
              <h1>{{ heading.title }}</h1>
              <p>{{ heading.sub }}</p>
            </div>
          </Transition>
        </div>

        <div v-if="mode !== 'setup' && auth?.registrationOpen" class="auth-tabs" :class="{ right: mode === 'register' }" role="tablist">
          <span class="tab-ind" aria-hidden="true" />
          <button type="button" role="tab" :aria-selected="mode === 'login'" :class="{ on: mode === 'login' }" @click="switchMode(false)">
            <Icon name="mingcute:entrance-line" /> Masuk
          </button>
          <button type="button" role="tab" :aria-selected="mode === 'register'" :class="{ on: mode === 'register' }" @click="switchMode(true)">
            <Icon name="mingcute:user-add-2-line" /> Daftar
          </button>
        </div>

        <form :class="{ shake }" @submit.prevent="submit" @animationend.self="shake = false">
          <label class="field">
            <span>Username</span>
            <div class="input-ic" :class="{ good: newAccount && usernameOk }">
              <Icon name="mingcute:user-3-line" class="lead" />
              <input
                v-model="form.username" autocomplete="username" required maxlength="30" placeholder="cth: cantik"
                @focus="focused = 'user'" @blur="focused = null"
              />
              <Transition name="pop"><Icon v-if="newAccount && usernameOk" name="mingcute:check-circle-fill" class="trail ok" /></Transition>
            </div>
          </label>

          <label class="field">
            <span>Password</span>
            <div class="input-ic pw">
              <Icon name="mingcute:lock-line" class="lead" />
              <input
                v-model="form.password" :type="showPw ? 'text' : 'password'" required maxlength="200" placeholder="••••••••"
                :autocomplete="newAccount ? 'new-password' : 'current-password'"
                @focus="focused = 'pw'" @blur="focused = null; capsLock = false" @keydown="checkCaps" @keyup="checkCaps"
              />
              <button type="button" :title="showPw ? 'Sembunyikan' : 'Lihat password'" @mousedown.prevent @click="showPw = !showPw"><Icon :name="showPw ? 'mingcute:eye-close-line' : 'mingcute:eye-2-line'" /></button>
            </div>
          </label>
          <Transition name="fade"><p v-if="capsLock" class="caps"><Icon name="mingcute:arrow-up-circle-line" /> Caps Lock sedang aktif</p></Transition>

          <Transition name="expand">
            <div v-if="newAccount" class="expand-box">
              <div class="pw-meter" :class="`s${strength}`" aria-live="polite">
                <div class="pw-bars"><i v-for="n in 4" :key="n" :class="{ on: n <= strength }" /></div>
                <span>{{ form.password ? strengthLabel : "Minimal 8 karakter" }}</span>
              </div>

              <label class="field">
                <span>Ulangi Password</span>
                <div class="input-ic" :class="{ bad: pwMismatch, good: !!form.password2 && !pwMismatch }">
                  <Icon name="mingcute:shield-line" class="lead" />
                  <input
                    v-model="form.password2" :type="showPw ? 'text' : 'password'" autocomplete="new-password" :required="newAccount" maxlength="200" placeholder="••••••••"
                    @focus="focused = 'pw'" @blur="focused = null"
                  />
                  <Transition name="pop"><Icon v-if="form.password2 && !pwMismatch" name="mingcute:check-circle-fill" class="trail ok" /></Transition>
                </div>
              </label>
              <p v-if="pwMismatch" class="hint bad">Password belum sama</p>
              <p v-else class="hint">Username 3-30 karakter: huruf, angka, titik, atau garis bawah</p>
            </div>
          </Transition>

          <label v-if="!newAccount" class="check">
            <input v-model="form.remember" type="checkbox" />
            Ingat saya selama 30 hari
          </label>

          <Transition name="fade">
            <p v-if="error" class="auth-error" role="alert"><Icon name="mingcute:warning-line" /> {{ error }}</p>
          </Transition>

          <button class="btn btn-primary btn-block btn-lg" :class="{ done: success }" :disabled="loading || success">
            <Icon
              :name="success ? 'mingcute:check-line' : loading ? 'mingcute:loading-line' : newAccount ? 'mingcute:user-add-2-line' : 'mingcute:entrance-line'"
              :class="{ spin: loading && !success }"
            />
            {{ success ? "Berhasil!" : loading ? "Sebentar..." : mode === "setup" ? "Buat Akun Admin" : mode === "register" ? "Daftar Sekarang" : "Masuk" }}
          </button>

          <p v-if="mode === 'register'" class="auth-foot">
            Sudah punya akun? <button type="button" class="auth-link" @click="switchMode(false)">Masuk di sini</button>
          </p>
          <p v-else-if="mode === 'login' && auth?.registrationOpen" class="auth-foot">
            Belum punya akun? <button type="button" class="auth-link" @click="switchMode(true)">Daftar gratis</button>
          </p>
          <p v-else-if="mode === 'login'" class="auth-foot">Belum punya akun? Minta admin untuk membuatkannya.</p>
        </form>
      </div>
      <p class="auth-copy">Dompet Manis · catat keuangan dengan manis</p>
    </main>
  </div>
</template>
