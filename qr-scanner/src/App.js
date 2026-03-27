import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

function App() {
  const [status, setStatus] = useState(null);
  const [name, setName] = useState("");

  const scannerRef = useRef(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    let scanner;

    const startScanner = async () => {
      const element = document.getElementById("reader");
      if (!element) return;

      scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10 },
          async (decodedText) => {
            console.log(decodedText);
            // защита от повторов
            if (isProcessingRef.current) return;
            isProcessingRef.current = true;

            // 🔥 остановка камеры
            if (scannerRef.current) {
              await scannerRef.current.stop();
            }

            const match = decodedText.match(/users\/(\d+)/);
            const id = match ? match[1] : null;
            console.log("ID из QR:", id);

            if (!id) {
              setStatus("not_found");
              setName("");
              return;
            }

            try {
              const res = await fetch("https://qr-backend-4acq.onrender.com/scan", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ id }),
              });

              const data = await res.json();

              setStatus(data.status);
              setName(data.name || "");
            } catch (e) {
              setStatus("error");
              setName("");
            }
          }
        );
      } catch (e) {
        console.log("Ошибка запуска камеры", e);
      }
    };

    const timer = setTimeout(startScanner, 800);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // 🔥 перезагрузка страницы через 2 секунды
  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <div
      style={{
        textAlign: "center",
        height: "100vh",
        background:
          status === "ok"
            ? "#2ecc71"
            : status === "duplicate"
            ? "#f39c12"
            : status === "not_found"
            ? "#e74c3c"
            : "white",
        color: status ? "white" : "black",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Камера */}
      {!status && (
        <>
          <h2>Сканирование QR</h2>

          <div
            id="reader"
            style={{
              width: "300px",
              border: "1px solid black",
            }}
          ></div>
        </>
      )}

      {/* Результат */}
      {status === "ok" && <h1>✅ {name}</h1>}
      {status === "duplicate" && <h1>⚠️ Уже отмечен</h1>}
      {status === "not_found" && <h1>❌ Не найден</h1>}
      {status === "error" && <h1>❌ Ошибка</h1>}
    </div>
  );
}

export default App;