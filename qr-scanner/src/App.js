import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

// 🔥 глобальный флаг (ВАЖНО)
let scannerStarted = false;

function App() {
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");

  const scannerRef = useRef(null);
  const lastTextRef = useRef("");

  useEffect(() => {
    if (scannerStarted) return; // 🔥 блокируем второй запуск
    scannerStarted = true;

    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

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

            if (decodedText === lastTextRef.current) return;
            lastTextRef.current = decodedText;

            setStatus("");
            setName("");

            if (!decodedText.includes("leader-id.ru/users/")) {
              setStatus("invalid_qr");
              return;
            }

            const match = decodedText.match(/users\/(\d+)/);
            if (!match) {
              setStatus("invalid_qr");
              return;
            }

            const id = match[1];

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
              } else {
                setStatus("error");
              }
            } catch (err) {
              console.error(err);
              setStatus("error");
            }
          }
        );
      } catch (e) {
        console.log("Ошибка запуска камеры", e);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2) {
            scannerRef.current.stop();
          }
        } catch (e) {
          console.log("Scanner already stopped");
        }
        scannerRef.current = null;
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