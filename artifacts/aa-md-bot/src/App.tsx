import { useState } from "react";
import ConnectScreen from "./components/ConnectScreen";
import SuccessScreen from "./components/SuccessScreen";
import AdminPanel from "./components/AdminPanel";
import "./dashboard.css";

export type Screen = "connect" | "success" | "admin";

export interface SessionInfo {
  sessId: string;
  number: string;
  isOwner?: boolean;
}

const OWNER_NUMBER = "923346741532";

function App() {
  const [screen, setScreen] = useState<Screen>("connect");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    localStorage.getItem("adminToken")
  );

  function handleConnected(info: SessionInfo) {
    const isOwner =
      info.number.replace(/\D/g, "") === OWNER_NUMBER ||
      info.number === OWNER_NUMBER;
    const enriched = { ...info, isOwner };
    setSession(enriched);
    if (isOwner) {
      const token = "owner-" + Date.now();
      localStorage.setItem("adminToken", token);
      setAdminToken(token);
      setScreen("admin");
    } else {
      setScreen("success");
    }
  }

  function handleAdminLogin(token: string) {
    localStorage.setItem("adminToken", token);
    setAdminToken(token);
    setScreen("admin");
  }

  function handleLogout() {
    localStorage.removeItem("adminToken");
    setAdminToken(null);
    setSession(null);
    setScreen("connect");
  }

  function handleBack() {
    setScreen("connect");
    setSession(null);
  }

  return (
    <>
      {screen === "connect" && (
        <ConnectScreen
          onConnected={handleConnected}
          onAdminLogin={handleAdminLogin}
        />
      )}
      {screen === "success" && session && (
        <SuccessScreen
          session={session}
          onBack={handleBack}
          onAdminLogin={handleAdminLogin}
        />
      )}
      {screen === "admin" && (
        <AdminPanel
          session={session}
          adminToken={adminToken}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}

export default App;
