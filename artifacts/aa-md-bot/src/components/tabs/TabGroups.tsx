import { useState, useEffect } from "react";

interface Props { apiHeaders: Record<string, string> }

export default function TabGroups({ apiHeaders }: Props) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadGroups(); }, []);

  async function loadGroups() {
    setLoading(true);
    try {
      const d = await fetch("/api/admin/groups", { headers: apiHeaders }).then(r => r.json());
      setGroups(d.groups || []);
    } catch {}
    setLoading(false);
  }

  function fmtDate(ts: number) {
    if (!ts) return "--";
    return new Date(ts).toLocaleDateString("en-PK");
  }

  return (
    <div>
      <div className="tab-header">
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{groups.length} group{groups.length !== 1 ? "s" : ""}</div>
        <button className="btn-primary" onClick={loadGroups}>🔄 Refresh</button>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid #1e3a5f", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#93c5fd", marginBottom: 16, lineHeight: 1.8 }}>
        📌 <strong>Tip:</strong> Group mein commands use karein:{" "}
        <code style={{ color: "var(--green)" }}>.antidelete on</code>,{" "}
        <code style={{ color: "var(--green)" }}>.antilink on</code>,{" "}
        <code style={{ color: "var(--green)" }}>.welcome on</code>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Group Ka Naam</th><th>Members</th><th>Bana</th><th>Description</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}><span className="spin" />Loading groups...</td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>Koi group nahi mila</td></tr>
            ) : groups.map((g: any, i: number) => (
              <tr key={i}>
                <td className="td-muted">{i + 1}</td>
                <td className="td-name">{g.name || "Unknown Group"}</td>
                <td className="td-muted">{g.members ?? "--"}</td>
                <td className="td-muted">{fmtDate(g.createdAt)}</td>
                <td className="td-muted" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.description || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
