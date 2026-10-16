<script setup lang="ts">
definePageMeta({ layout: false });

const auth = useAuthStatus();
// setup = akun admin pertama, register = pendaftaran mandiri, login = masuk biasa
const registering = ref(false);
const mode = computed(() => (auth.value?.setupRequired ? "setup" : registering.value && auth.value?.registrationOpen ? "register" : "login"));
const newAccount = computed(() => mode.value !== "login");
useHead({ title: () => (mode.value === "login" ? "Masuk · Dompet Manis" : "Daftar · Dompet Manis") });

const form = reactive({ username: "", password: "", password2: "", remember: false });
const showPw = ref(false);
const error = ref("");
const loading = ref(false);
const shake = ref(false);

function switchMode(reg: boolean) {
  registering.value = reg;
  error.value = "";
  form.password = form.password2 = "";
}

async function submit() {
  error.value = "";
  if (newAccount.value) {
    if (form.password.length < 8) return (error.value = "Password minimal 8 karakter ya");
    if (form.password !== form.password2) return (error.value = "Password tidak sama");
  }
  loading.value = true;
  try {
    const url = { setup: "/api/auth/setup", register: "/api/auth/register", login: "/api/auth/login" }[mode.value];
    await api(url, {
      method: "POST",
      body: { username: form.username.trim(), password: form.password, remember: form.remember },
    });
    auth.value = null; // muat ulang status di middleware
    await navigateTo("/");
  } catch (e) {
    error.value = (e as Error).message;
    form.password = form.password2 = "";
    shake.value = false;
    requestAnimationFrame(() => (shake.value = true));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-deco d1" aria-hidden="true" />
    <div class="auth-deco d2" aria-hidden="true" />
    <div class="auth-deco d3" aria-hidden="true" />

    <main class="auth-card">
      <div class="auth-head">
        <div class="auth-logo" :class="{ shake }"><Icon :name="newAccount ? 'mingcute:bowknot-fill' : 'mingcute:lock-fill'" /></div>
        <h1>Dompet Manis</h1>
        <p v-if="mode === 'setup'">Selamat datang! Buat akun pertama — akun ini otomatis menjadi admin</p>
        <p v-else-if="mode === 'register'">Buat akun gratis dan mulai catat keuanganmu</p>
        <p v-else>Masuk dulu yuk untuk melihat dompetmu</p>
      </div>

      <form @submit.prevent="submit">
        <label class="field">
          <span>Username</span>
          <input v-model="form.username" autocomplete="username" required maxlength="30" placeholder="cth: cantik" />
        </label>

        <label class="field">
          <span>Password</span>
          <div class="pw">
            <input
              v-model="form.password" :type="showPw ? 'text' : 'password'" required maxlength="200" placeholder="••••••••"
              :autocomplete="newAccount ? 'new-password' : 'current-password'"
            />
            <button type="button" :title="showPw ? 'Sembunyikan' : 'Lihat password'" @click="showPw = !showPw"><Icon :name="showPw ? 'mingcute:eye-close-line' : 'mingcute:eye-2-line'" /></button>
          </div>
        </label>

        <template v-if="newAccount">
          <label class="field">
            <span>Ulangi Password</span>
            <input v-model="form.password2" :type="showPw ? 'text' : 'password'" autocomplete="new-password" required maxlength="200" placeholder="••••••••" />
          </label>
          <p class="hint">Username 3-30 karakter (huruf, angka, titik, garis bawah). Password minimal 8 karakter</p>
        </template>

        <label v-else class="check">
          <input v-model="form.remember" type="checkbox" />
          Ingat saya selama 30 hari
        </label>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <button class="btn btn-primary btn-block" :disabled="loading">
          <Icon :name="newAccount ? 'mingcute:user-add-2-line' : 'mingcute:entrance-line'" />
          {{ loading ? "Sebentar..." : mode === "setup" ? "Buat Akun" : mode === "register" ? "Daftar" : "Masuk" }}
        </button>

        <p v-if="mode === 'register'" class="auth-foot">
          Sudah punya akun? <button type="button" class="auth-link" @click="switchMode(false)">Masuk di sini</button>
        </p>
        <p v-else-if="mode === 'login' && auth?.registrationOpen" class="auth-foot">
          Belum punya akun? <button type="button" class="auth-link" @click="switchMode(true)">Daftar gratis</button>
        </p>
        <p v-else-if="mode === 'login'" class="auth-foot">Belum punya akun? Minta admin untuk membuatkannya.</p>
      </form>
    </main>
  </div>
</template>
