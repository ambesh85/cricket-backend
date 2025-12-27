import React, { useState } from "react";

const API = "https://cricket-backend-xr6g.onrender.com";

function App() {
  /* ---------------- STATES ---------------- */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");

  const [matches, setMatches] = useState([]);
  const [oddsData, setOddsData] = useState({});
  const [betAmount, setBetAmount] = useState(100);

  /* ---------------- LOGIN ---------------- */
  const login = async () => {
    setMessage("");
    try {
      const res = await fetch(API + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Login failed");
        return;
      }

      setUser(data);
      loadMatches();
    } catch {
      setMessage("Server not reachable");
    }
  };

  /* ---------------- LOAD MATCHES ---------------- */
  const loadMatches = async () => {
    try {
      const res = await fetch(API + "/api/cricket/live");
      const data = await res.json();
      setMatches(data || []);
    } catch {
      setMessage("Failed to load matches");
    }
  };

  /* ---------------- LOAD ODDS ---------------- */
  const loadOdds = async (matchId) => {
    try {
      const res = await fetch(API + "/api/odds/" + matchId);
      const data = await res.json();

      setOddsData((prev) => ({
        ...prev,
        [matchId]: data.odds,
      }));
    } catch {
      alert("Failed to load odds");
    }
  };

  /* ---------------- PLACE BET ---------------- */
  const placeBet = async (match, teamKey) => {
    const odds = oddsData[match.id]?.[teamKey];

    if (!odds) {
      alert("Odds not loaded");
      return;
    }

    if (betAmount <= 0) {
      alert("Invalid bet amount");
      return;
    }

    try {
      const res = await fetch(API + "/api/bet/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterId: user.masterId,
          matchId: match.id,
          team: teamKey,
          odds,
          amount: betAmount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }

      setUser({ ...user, credits: data.updatedCredits });

      alert(
        `Bet placed!\nTeam: ${teamKey}\nOdds: ${odds}x\nAmount: ₹${betAmount}`
      );
    } catch {
      alert("Server error while placing bet");
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2>🏏 Cricket Betting App</h2>

      {!user ? (
        /* ---------- LOGIN UI ---------- */
        <div>
          <h3>User Login</h3>

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <br />
          <br />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <br />
          <br />

          <button onClick={login}>Login</button>

          <p style={{ color: "red" }}>{message}</p>
        </div>
      ) : (
        /* ---------- DASHBOARD ---------- */
        <div>
          <h3>Welcome, {user.name}</h3>
          <p>💰 Credits: ₹{user.credits}</p>

          <label>
            Bet Amount ₹
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              style={{ width: 80, marginLeft: 5 }}
            />
          </label>

          <h3 style={{ marginTop: 20 }}>🔥 Live & Upcoming Matches</h3>

          {matches.length === 0 ? (
            <p>No matches available</p>
          ) : (
            <table border="1" cellPadding="8">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Status</th>
                  <th>Odds & Bet</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.status}</td>
                    <td>
                      <button onClick={() => loadOdds(m.id)}>Load Odds</button>

                      {oddsData[m.id] && (
                        <div style={{ marginTop: 5 }}>
                          <button onClick={() => placeBet(m, "teamA")}>
                            Team A ({oddsData[m.id].teamA}x)
                          </button>
                          <br />
                          <button onClick={() => placeBet(m, "teamB")}>
                            Team B ({oddsData[m.id].teamB}x)
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
