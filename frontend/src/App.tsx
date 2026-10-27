import { useEffect, useState } from "react";

type ApiStatus = "checking" | "ok" | "unreachable";

const statusText: Record<ApiStatus, string> = {
  checking: "Sunucu kontrol ediliyor…",
  ok: "Sunucu çalışıyor",
  unreachable: "Sunucuya bağlanılamadı",
};

export default function App() {
  const [status, setStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    fetch("/api/v1/health")
      .then((response) => setStatus(response.ok ? "ok" : "unreachable"))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "4rem auto" }}>
      <h1>Kürsü</h1>
      <p>Meclis münazara oyunu: yapay zekâ rakibe karşı tartış, bağımsız hakem değerlendirsin.</p>
      <p role="status">{statusText[status]}</p>
    </main>
  );
}
