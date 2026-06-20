import { useState } from "react";
import ConnectScreen from "./components/ConnectScreen";
import ConnectedScreen from "./components/ConnectedScreen";
import "./dashboard.css";

export type Screen = "connect" | "connected";

export interface SessionInfo {
  sessId: string;
  number: string;
  name?: string;
}

function App() {
  const [screen, setScreen] = useState<Screen>("connect");
  const [session, setSession] = useState<SessionInfo | null>(null);

  function handleConnected(info: SessionInfo) {
    setSession(info);
    setScreen("connected");
  }

  function handleDisconnect() {
    setSession(null);
    setScreen("connect");
  }

  return (
    <>
      {screen === "connect" && <ConnectScreen onConnected={handleConnected} />}
      {screen === "connected" && session && (
        <ConnectedScreen session={session} onDisconnect={handleDisconnect} />
      )}
    </>
  );
}

export default App;
