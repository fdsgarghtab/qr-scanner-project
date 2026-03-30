import React, { useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

function App() {
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const scannerRef = useRef(null);
  const lastTextRef = useRef("");
  const cooldownRef = useRef(false);

  // 🔊 ЗВУКИ (создаются 1 раз)
  const successSound = useRef(new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg"));
  const warningSound = useRef(new Audio("https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg"));
  const errorSound = useRef(new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg"));

  const playFeedback = (type) => {
    if (soundOn) {
      let sound;

      if (type === "ok") sound = successSound.current;
      else if (type === "duplicate") sound = warningSound.current;
      else sound = errorSound.current;

      sound.currentTime = 0;
      sound.play().catch(() => {});
    }

    // 📳 Вибрация ВСЕГДА
    if (navigator.vibrate) {
      if (type === "ok") navigator.vibrate(200);
      else if (type === "duplicate") navigator.vibrate([100, 50, 100]);
      else navigator.vibrate(300);
    }
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
          playFeedback("error");
          reset();
          return;
        }

        const match = decodedText.match(/users\/(\d+)/);
        if (!match) {
          setStatus("invalid");
          playFeedback("error");
          reset();
          return;
        }

        const id = match[1];

        try {
          const res = await fetch("https://qr-backend-4acq.onrender.com/scan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ id }),
          });

          const data = await res.json();

          if (data.status === "ok") {
            setStatus("ok");
            setName(data.name);
            playFeedback("ok");
          } else if (data.status === "duplicate") {
            setStatus("duplicate");
            setName(data.name);
            playFeedback("duplicate");
          } else if (data.status === "not_found") {
            setStatus("not_found");
            playFeedback("error");
          } else {
            setStatus("error");
            playFeedback("error");
          }
        } catch {
          setStatus("error");
          playFeedback("error");
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
    cameraOn ? stopCamera() : startCamera();
  };

  const reset = () => {
    setTimeout(() => {
      setStatus("");
      setName("");
      cooldownRef.current = false;
    }, 2000);
  };

  const getColor = () => {
    if (status === "ok") return "#16a34a";
    if (status === "duplicate") return "#f59e0b";
    if (status) return "#dc2626";
    return "#000";
  };

  return (
    <div style={{ padding: "10px", fontFamily: "sans-serif" }}>
      <h2 style={{ textAlign: "center", margin: "10px 0" }}>QR Check-in</h2>

      {/* КНОПКИ */}
      <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
        <button onClick={toggleCamera} style={{ fontSize: "16px", padding: "10px" }}>
          {cameraOn ? "📴 Камера" : "📷 Камера"}
        </button>

        <button onClick={() => setSoundOn(!soundOn)} style={{ fontSize: "16px", padding: "10px" }}>
          {soundOn ? "🔊" : "🔇"}
        </button>
      </div>

      {/* КАМЕРА */}
      <div id="reader" style={{ width: "100%", maxWidth: "320px", margin: "10px auto" }} />

      {/* СТАТУС */}
      <div
        style={{
          marginTop: "10px",
          fontSize: "20px",
          fontWeight: "bold",
          color: getColor(),
          textAlign: "center",
          minHeight: "50px",
        }}
      >
        {status === "ok" && `✅ ${name}`}
        {status === "duplicate" && `⚠️ Уже отмечен: ${name}`}
        {status === "not_found" && "❌ Не найден"}
        {status === "invalid" && "❌ Неверный QR"}
        {status === "error" && "❌ Ошибка"}
      </div>
    </div>
  );
}

export default App;