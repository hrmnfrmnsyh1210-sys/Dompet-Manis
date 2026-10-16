let timer: ReturnType<typeof setTimeout> | undefined;

export function useToast() {
  const toast = useState("toast", () => ({ msg: "", show: false, error: false }));
  function show(msg: string, error = false) {
    toast.value = { msg, show: true, error };
    clearTimeout(timer);
    timer = setTimeout(() => (toast.value.show = false), 2600);
  }
  return {
    toast,
    show,
    fail: (e: unknown) => show(((e as Error)?.message || "Terjadi kesalahan"), true),
  };
}
