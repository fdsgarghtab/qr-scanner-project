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

  // 🔊 звуки
  const playSound = (type) => {
    if (!soundOn) return;

    const audio = new Audio(
      type === "ok"
        ? "https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg"
        : "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
    );
    audio.play();
  };

  const startCamera = async () => {
    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        if (cooldownRef.current) return;

        if (decodedText === lastTextRef.current) return;
        lastTextRef.current = decodedText;
        cooldownRef.current = true;

        setStatus("");
        setName("");

        if (!decodedText.includes("leader-id.ru/users/")) {
          setStatus("invalid");
          playSound("error");
          navigator.vibrate?.(100);
          resetStatus();
          return;
        }

        const match = decodedText.match(/users\/(\d+)/);
        if (!match) {
          setStatus("invalid");
          playSound("error");
          navigator.vibrate?.(100);
          resetStatus();
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
            playSound("ok");
            navigator.vibrate?.(200);
          } else if (data.status === "duplicate") {
            setStatus("duplicate");
            setName(data.name);
            playSound("error");
          } else if (data.status === "not_found") {
            setStatus("not_found");
            playSound("error");
          } else {
            setStatus("error");
            playSound("error");
          }
        } catch {
          setStatus("error");
          playSound("error");
        }

        resetStatus();
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

  const resetStatus = () => {
    setTimeout(() => {
      setStatus("");
      setName("");
      cooldownRef.current = false;
    }, 2500);
  };

  const getColor = () => {
    switch (status) {
      case "ok":
        return "green";
      case "duplicate":
        return "orange";
      case "invalid":
      case "error":
      case "not_found":
        return "red";
      default:
        return "black";
    }
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>QR Check-in</h1>

      <div style={{ marginBottom: "10px" }}>
        <button onClick={toggleCamera} style={{ fontSize: "18px", margin: "5px" }}>
          {cameraOn ? "📴 Выключить камеру" : "📷 Включить камеру"}
        </button>

        <button onClick={() => setSoundOn(!soundOn)} style={{ fontSize: "18px", margin: "5px" }}>
          {soundOn ? "🔊 Звук ВКЛ" : "🔇 Звук ВЫКЛ"}
        </button>
      </div>

      <div id="reader" style={{ width: "300px", margin: "auto" }} />

      <div
        style={{
          marginTop: "20px",
          fontSize: "26px",
          fontWeight: "bold",
          color: getColor(),
          minHeight: "40px",
        }}
      >
        {status === "ok" && `✅ Отмечен: ${name}`}
        {status === "duplicate" && `⚠️ Уже отмечен: ${name}`}
        {status === "not_found" && "❌ Не найден"}
        {status === "invalid" && "❌ Неверный QR"}
        {status === "error" && "❌ Ошибка"}
      </div>
    </div>
  );
}

export default App;