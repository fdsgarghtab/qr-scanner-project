import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

function App() {
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");

  const lastScanRef = useRef(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return; // 🔥 защита от двойного запуска
    hasStarted.current = true;

    const html5QrCode = new Html5Qrcode("reader");
    let isRunning = false;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: 250,
          },
          async (decodedText) => {
            console.log("QR:", decodedText);

            const text = decodedText.trim();

            // 🔒 строгая проверка Leader-ID
            if (!/^https:\/\/leader-id\.ru\/users\/\d+/.test(text)) {
              setStatus("invalid_qr");
              setName("");
              return;
            }

            // 🔥 анти-дребезг
            if (Date.now() - lastScanRef.current < 3000) return;
            lastScanRef.current = Date.now();

            // 🔥 извлекаем ID
            const match = text.match(/users\/(\d+)/);
            if (!match) {
              setStatus("invalid_qr");
              setName("");
              return;
            }

            const id = match[1];
            console.log("ID:", id);

            try {
              const res = await fetch(
                "https://qr-backend-4acq.onrender.com/scan",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ id }),
                }
              );

              const data = await res.json();

              if (data.status === "ok") {
                setStatus("ok");
                setName(data.name);
              } else if (data.status === "duplicate") {
                setStatus("duplicate");
                setName(data.name);
              } else if (data.status === "not_found") {
                setStatus("not_found");
                setName("");
              } else {
                setStatus("error");
              }
            } catch (err) {
              console.error(err);
              setStatus("error");
            }
          }
        );

        isRunning = true;
      } catch (e) {
        console.log("Ошибка запуска камеры", e);
      }
    };

    startScanner();

    return () => {
      if (isRunning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <h1>QR Check-in</h1>

      <div id="reader" style={{ width: "300px", margin: "auto" }} />

      <div style={{ marginTop: "20px", fontSize: "20px" }}>
        {status === "ok" && (
          <div style={{ color: "green" }}>
            ✅ Отмечен: {name}
          </div>
        )}

        {status === "duplicate" && (
          <div style={{ color: "orange" }}>
            ⚠️ Уже отмечен: {name}
          </div>
        )}

        {status === "not_found" && (
          <div style={{ color: "red" }}>
            ❌ Не найден
          </div>
        )}

        {status === "invalid_qr" && (
          <div style={{ color: "red" }}>
            ❌ Неверный QR-код
          </div>
        )}

        {status === "error" && (
          <div style={{ color: "red" }}>
            🚫 Ошибка сервера
          </div>
        )}
      </div>
    </div>
  );
}

export default App;