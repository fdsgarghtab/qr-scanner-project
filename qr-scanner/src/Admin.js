import React, { useState } from "react";

function Admin() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(null);
  const [error, setError] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    try {
      const res = await fetch(
        "https://qr-backend-4acq.onrender.com/admin-login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );

      if (!res.ok) {
        setError("Неверный пароль");
        return;
      }

      const json = await res.json();
      setToken(json.token);

    } catch {
      setError("Ошибка сервера");
    }
  };

  const loadData = async () => {
    setLoading(true);

    try {
      const res = await fetch(
        "https://qr-backend-4acq.onrender.com/admin-data",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json();
      setData(json);
    } catch {
      alert("Ошибка загрузки");
    }

    setLoading(false);
  };

  if (!token) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Админка</h2>

        <input
          type="password"
          placeholder="Введите пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <br /><br />

        <button onClick={handleLogin}>Войти</button>

        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Админ-панель</h2>

      <button onClick={loadData}>
        {loading ? "Загрузка..." : "Обновить"}
      </button>

      {data && (
        <div>
          <p>👥 Всего: {data.total}</p>
          <p>✅ Пришло: {data.checked}</p>

          <h3>Последние:</h3>
          {data.logs.map((n, i) => (
            <div key={i}>• {n}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Admin;