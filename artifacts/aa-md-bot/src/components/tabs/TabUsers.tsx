import { useState, useEffect } from "react";

interface Props { apiHeaders: Record<string, string> }

const PER_PAGE = 50;

function timeAgo(ts: number) {
  if (!ts) return "kabhi nahi";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "abhi abhi";
  if (m < 60) return m + "m pehle";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h pehle";
  return Math.floor(h / 24) + "d pehle";
}

export default function TabUsers({ apiHeaders }: Props) {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const d = await fetch("/api/admin/users", { headers: apiHeaders }).then(r => r.json());
      const u = d.users || [];
      setAllUsers(u);
      setFiltered(u);
    } catch {}
    setLoading(false);
  }

  function filterUsers(q: string) {
    setSearch(q);
    const f = q ? allUsers.filter(u => u.number?.includes(q) || (u.name || "").toLowerCase().includes(q.toLowerCase())) : [...allUsers];
    setFiltered(f);
    setPage(1);
  }

  async function doBan(jid: string) {
    if (!confirm(`Ban +${jid.split("@")[0]}?`)) return;
    await fetch(`/api/admin/users/${encodeURIComponent(jid)}/ban`, { method: "POST", headers: apiHeaders });
    const u = allUsers.find(x => x.jid === jid);
    if (u) { u.banned = true; setAllUsers([...allUsers]); setFiltered([...allUsers]); }
  }

  async function doUnban(jid: string) {
    await fetch(`/api/admin/users/${encodeURIComponent(jid)}/unban`, { method: "POST", headers: apiHeaders });
    const u = allUsers.find(x => x.jid === jid);
    if (u) { u.banned = false; setAllUsers([...allUsers]); setFiltered([...allUsers]); }
  }

  async function doDelete(jid: string) {
    const num = "+" + jid.split("@")[0];
    if (!confirm(`User ${num} ko delete karein? Ye undo nahi ho sakta.`)) return;
    const d = await fetch(`/api/admin/users/${encodeURIComponent(jid)}`, { method: "DELETE", headers: apiHeaders }).then(r => r.json());
    if (d.success) {
      const nu = allUsers.filter(x => x.jid !== jid);
      setAllUsers(nu);
      setFiltered(nu.filter(u => !search || u.number?.includes(search)));
    }
  }

  async function deleteAll() {
    if (!confirm("⚠️ OWNER KE SIWA SAARE USERS DELETE KAREIN?\n\nYe permanent hai aur undo nahi hoga.\n\nJari rakhein?")) return;
    setMsg("⏳ Delete ho raha hai...");
    const d = await fetch("/api/admin/users", { method: "DELETE", headers: apiHeaders }).then(r => r.json());
    if (d.success) {
      setMsg(`✅ ${d.deleted} user(s) delete kiye gaye`);
      loadUsers();
    } else {
      setMsg("❌ " + (d.error || "Failed"));
    }
    setTimeout(() => setMsg(""), 5000);
  }

  const start = (page - 1) * PER_PAGE;
  const pageData = filtered.slice(start, start + PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  return (
    <div>
      <div className="tab-header">
        <input className="search-input" placeholder="🔍 Number ya naam dhundein..." value={search} onChange={e => filterUsers(e.target.value)} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{filtered.length} users</div>
          <button className="btn-danger" onClick={deleteAll}>🗑️ Owner ke siwa sab delete</button>
        </div>
      </div>

      {msg && <div className={`settings-msg ${msg.startsWith("✅") ? "msg-ok" : "msg-err"}`} style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Number</th><th>Naam</th><th>Level</th><th>Cmds</th><th>Balance</th><th>Last Seen</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}><span className="spin" />Loading...</td></tr>
            ) : pageData.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>Koi user nahi mila</td></tr>
            ) : pageData.map((u: any, i: number) => (
              <tr key={u.jid || i}>
                <td className="td-muted">{start + i + 1}</td>
                <td className="td-num">+{u.number}</td>
                <td className="td-name">{u.name || "Unknown"}</td>
                <td><span className="badge badge-blue">Lv {u.level ?? 0}</span></td>
                <td className="td-muted">{u.commandsUsed ?? 0}</td>
                <td className="td-muted">💰 {u.balance ?? 0}</td>
                <td className="td-muted" style={{ fontSize: 11 }}>{timeAgo(u.lastSeen)}</td>
                <td>
                  {u.banned
                    ? <span className="badge badge-red">Banned</span>
                    : u.premium
                    ? <span className="badge badge-yellow">⭐ Premium</span>
                    : <span className="badge badge-green">Active</span>}
                </td>
                <td style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {u.banned
                    ? <button className="btn-unban" onClick={() => doUnban(u.jid)}>Unban</button>
                    : <button className="btn-ban" onClick={() => doBan(u.jid)}>Ban</button>}
                  <button className="btn-ban" style={{ fontSize: 11 }} onClick={() => doDelete(u.jid)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} className={`page-btn${page === i + 1 ? " active" : ""}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
          ))}
        </div>
      )}
    </div>
  );
}
