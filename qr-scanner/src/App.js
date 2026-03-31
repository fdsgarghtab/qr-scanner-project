import React, { useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

// ================= SCANNER =================
function Scanner() {
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [flash, setFlash] = useState("");
  const [logs, setLogs] = useState([]);

  const scannerRef = useRef(null);
  const lastTextRef = useRef("");
  const cooldownRef = useRef(false);

  const triggerFlash = (type) => {
    setFlash(type);
    setTimeout(() => setFlash(""), 400); // 🔥 БЫЛО 150
  };

  const playFeedback = (type) => {
    if (navigator.vibrate) {
      if (type === "ok") navigator.vibrate(200);
      else if (type === "duplicate") navigator.vibrate([100, 50, 100]);
      else navigator.vibrate(300);
    }
  };

  const addLog = (text) => {
    setLogs((prev) => [text, ...prev].slice(0, 5));
  };

  const startCamera = async () => {
    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      async (decodedText) => {
        if (cooldownRef.current) return;
        if (decodedText === lastTextRef.current) return;

        lastTextRef.current = decodedText;
        cooldownRef.current = true;

        if (!decodedText.includes("leader-id.ru/users/")) {
          setStatus("invalid");
          triggerFlash("error");
          playFeedback("error");
          addLog("❌ Неверный QR");
          reset();
          return;
        }

        const match = decodedText.match(/users\/(\d+)/);
        if (!match) {
          setStatus("invalid");
          triggerFlash("error");
          playFeedback("error");
          addLog("❌ Неверный QR");
          reset();
          return;
        }

        const id = match[1];

        try {
          const res = await fetch(
            "https://qr-backend-4acq.onrender.com/scan",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            }
          );

          const data = await res.json();

          if (data.status === "ok") {
            setStatus("ok");
            setName(data.name);
            triggerFlash("ok");
            playFeedback("ok");
            addLog(`✅ ${data.name}`);
          } else if (data.status === "duplicate") {
            setStatus("duplicate");
            setName(data.name);
            triggerFlash("duplicate");
            playFeedback("duplicate");
            addLog(`⚠️ ${data.name}`);
          } else if (data.status === "not_found") {
            setStatus("not_found");
            triggerFlash("error");
            playFeedback("error");
            addLog("❌ Не найден");
          } else {
            setStatus("error");
            triggerFlash("error");
            playFeedback("error");
            addLog("❌ Ошибка");
          }
        } catch {
          setStatus("error");
          triggerFlash("error");
          playFeedback("error");
          addLog("❌ Сервер");
        }

        reset();
      }
    );

    setCameraOn(true);
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setCameraOn(false);
  };

  const toggleCamera = () => {
    if (!cameraOn) {
      startCamera();
    } else {
      stopCamera();
    }
  };

  const reset = () => {
    setTimeout(() => {
      setStatus("");
      setName("");
      cooldownRef.current = false;
    }, 2000);
  };

  const getFlashColor = () => {
    if (flash === "ok") return "rgba(34,197,94,0.5)";
    if (flash === "duplicate") return "rgba(234,179,8,0.5)";
    if (flash === "error") return "rgba(239,68,68,0.5)";
    return "transparent";
  };

  return (
    <div style={{ padding: "10px", fontFamily: "sans-serif", position: "relative" }}>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: getFlashColor(),
          pointerEvents: "none",
          transition: "0.3s", // 🔥 мягче
        }}
      />

      <h2 style={{ textAlign: "center" }}>QR Check-in</h2>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button onClick={toggleCamera}>
          {cameraOn ? "📴 Камера" : "📷 Камера"}
        </button>
      </div>

      <div id="reader" style={{ width: "100%", maxWidth: "320px", margin: "10px auto" }} />

      <div style={{ textAlign: "center", fontWeight: "bold", marginTop: "10px" }}>
        {status === "ok" && `✅ ${name}`}
        {status === "duplicate" && `⚠️ ${name}`}
        {status === "not_found" && "❌ Не найден"}
        {status === "invalid" && "❌ Неверный QR"}
        {status === "error" && "❌ Ошибка"}
      </div>

      <div style={{ marginTop: "15px", fontSize: "14px" }}>
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}

export default Scanner;