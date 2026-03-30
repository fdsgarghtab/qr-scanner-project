import React, { useState } from "react";

function Admin() {
  const [password, setPassword] = useState("");
  const [auth, setAuth] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🔐 логин
  const handleLogin = async () => {
    setError("");

    try {
      const res = await fetch(
        "https://qr-backend-4acq.onrender.com/admin-login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        }
      );

      if (res.ok) {
        setAuth(true);
      } else {
        setError("Неверный пароль");
      }
    } catch {
      setError("Ошибка сервера");
    }
  };

  // 📊 загрузка данных
  const loadData = async () => {
    setLoading(true);

    try {
      const res = await fetch(
        "https://qr-backend-4acq.onrender.com/admin-data"
      );

      const json = await res.json();
      setData(json);
    } catch {
      alert("Ошибка загрузки");
    }

    setLoading(false);
  };

  // 🔐 экран логина
  if (!auth) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Админка</h2>

        <input
          type="password"
          placeholder="Введите пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "10px", fontSize: "16px" }}
        />

        <br /><br />

        <button onClick={handleLogin} style={{ padding: "10px 20px" }}>
          Войти
        </button>

        {error && (
          <p style={{ color: "red", marginTop: "10px" }}>{error}</p>
        )}
      </div>
    );
  }

  // 📊 админка
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>Админ-панель</h2>

      <button
        onClick={loadData}
        disabled={loading}
        style={{ padding: "10px 20px" }}
      >
        {loading ? "Загрузка..." : "Обновить"}
      </button>

      {data && (
        <div style={{ marginTop: "20px" }}>
          <p>👥 Всего: {data.total}</p>
          <p>✅ Пришло: {data.checked}</p>

          <h3>Последние отметки:</h3>
          {data.logs.map((name, i) => (
            <div key={i}>• {name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Admin;