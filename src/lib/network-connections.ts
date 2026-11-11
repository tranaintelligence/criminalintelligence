import { supabase } from "@/integrations/supabase/client";
import { API_URL } from "@/lib/trana-backend";

export type NetworkRole = "lawyer" | "student";

export type ConnectionStatus = "none" | "pending_sent" | "pending_received" | "connected";

export interface ConnectionRecord {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserRole: NetworkRole;
  fromUserRoleLabel: string;
  fromUserCity: string;
  toUserId: string;
  toUserName: string;
  toUserRole: NetworkRole;
  toUserRoleLabel?: string;
  toUserCity?: string;
  status: "pending" | "accepted" | "declined";
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkMember {
  id: string;
  name: string;
  role: NetworkRole;
  roleLabel: string;
  affiliation: string;
  city: string;
  experienceOrYear: string;
  specialisationOrInterests: string;
  bio?: string;
  isVerified: boolean;
  email?: string;
  phone?: string;
}

const STORAGE_KEY = "trana_network_connections_v2";

export function getLocalConnections(): ConnectionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalConnections(list: ConnectionRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("trana_network_connections_changed"));
  } catch {}
}

export async function fetchAllConnections(currentUserId: string): Promise<ConnectionRecord[]> {
  const local = getLocalConnections();

  // 1. Fetch real-time peer connections from TRANA backend API
  try {
    const uParam = currentUserId ? `?user_id=${encodeURIComponent(currentUserId)}` : "";
    const backendRes = await fetch(`${API_URL}/api/network/connections${uParam}`);
    if (backendRes.ok) {
      const backendRows = await backendRes.json();
      if (Array.isArray(backendRows)) {
        backendRows.forEach((r: any) => {
          const cId = r.id;
          const existingIdx = local.findIndex((c) => c.id === cId);
          const mapped: ConnectionRecord = {
            id: cId,
            fromUserId: r.from_user_id,
            fromUserName: r.from_user_name,
            fromUserRole: r.from_user_role || "lawyer",
            fromUserRoleLabel: r.from_user_role_label || "Verified Advocate",
            fromUserCity: r.from_user_city || "New Delhi",
            toUserId: r.to_user_id,
            toUserName: r.to_user_name,
            toUserRole: r.to_user_role || "lawyer",
            toUserRoleLabel: r.to_user_role_label || "Verified Advocate",
            toUserCity: r.to_user_city || "New Delhi",
            status: r.status,
            note: r.note,
            createdAt: r.created_at || new Date().toISOString(),
            updatedAt: r.updated_at || new Date().toISOString(),
          };
          if (existingIdx !== -1) {
            local[existingIdx] = mapped;
          } else {
            local.push(mapped);
          }
        });
      }
    }
  } catch (backendErr) {
    console.warn("Backend peer connections fetch fallback:", backendErr);
  }

  // 2. Query Supabase consultations where consult_type = 'peer_connection'
  try {
    const { data: dbRows, error: dbErr } = await supabase
      .from("consultations")
      .select("*")
      .eq("consult_type", "peer_connection")
      .order("created_at", { ascending: false });

    if (!dbErr && dbRows && dbRows.length > 0) {
      dbRows.forEach((row) => {
        let meta: any = {};
        try {
          if (row.note) meta = JSON.parse(row.note);
        } catch {}

        const fromId = String(meta.fromUserId || row.user_id || "").toLowerCase().trim();
        const toId = String(meta.toUserId || row.lawyer_id || "").toLowerCase().trim();
        const connId = `CONN-${row.id}`;
        const isAccepted = row.status === "confirmed" || row.status === "accepted";
        const isDeclined = row.status === "denied" || row.status === "cancelled";
        const st: "accepted" | "declined" | "pending" = isAccepted ? "accepted" : isDeclined ? "declined" : "pending";

        const existingIdx = local.findIndex((c) => {
          if (c.id === connId) return true;
          const cFrom = c.fromUserId.toLowerCase().trim();
          const cTo = c.toUserId.toLowerCase().trim();
          return (cFrom === fromId && cTo === toId) || (cFrom === toId && cTo === fromId);
        });

        if (existingIdx !== -1) {
          local[existingIdx].id = connId;
          local[existingIdx].status = st;
          local[existingIdx].updatedAt = row.created_at || new Date().toISOString();
        } else {
          local.push({
            id: connId,
            fromUserId: meta.fromUserId || row.user_id,
            fromUserName: meta.fromUserName || "Professional Member",
            fromUserRole: meta.fromUserRole || "lawyer",
            fromUserRoleLabel: meta.fromUserRoleLabel || "Member",
            fromUserCity: meta.fromUserCity || "New Delhi",
            toUserId: meta.toUserId || row.lawyer_id,
            toUserName: meta.toUserName || row.lawyer_name || "Colleague",
            toUserRole: meta.toUserRole || "lawyer",
            status: st,
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.created_at || new Date().toISOString(),
          });
        }
      });
    }
  } catch (e) {
    console.warn("fetchAllConnections Supabase fetch error:", e);
  }

  // Deduplicate array so each unique pair of users has strictly ONE record,
  // prioritizing "accepted" over "pending" over "declined".
  const pairSeen = new Map<string, ConnectionRecord>();
  for (const c of local) {
    const u1 = c.fromUserId.toLowerCase().trim();
    const u2 = c.toUserId.toLowerCase().trim();
    const pairKey = u1 < u2 ? `${u1}__${u2}` : `${u2}__${u1}`;

    const prev = pairSeen.get(pairKey);
    if (!prev) {
      pairSeen.set(pairKey, c);
    } else {
      if (c.status === "accepted" && prev.status !== "accepted") {
        pairSeen.set(pairKey, c);
      }
    }
  }

  const result = Array.from(pairSeen.values());
  saveLocalConnections(result);
  return result;
}

export function getConnectionStatusBetween(
  connections: ConnectionRecord[],
  myId: string | string[],
  otherId: string | string[]
): { status: ConnectionStatus; connection?: ConnectionRecord } {
  const myNorms = (Array.isArray(myId) ? myId : [myId]).filter(Boolean).map((s) => s.toLowerCase().trim());
  const otherNorms = (Array.isArray(otherId) ? otherId : [otherId]).filter(Boolean).map((s) => s.toLowerCase().trim());

  // Find all matches between these two members
  const matches = connections.filter((c) => {
    const fromNorm = c.fromUserId.toLowerCase().trim();
    const toNorm = c.toUserId.toLowerCase().trim();
    const fromIsMe = myNorms.includes(fromNorm);
    const toIsMe = myNorms.includes(toNorm);
    const fromIsOther = otherNorms.includes(fromNorm);
    const toIsOther = otherNorms.includes(toNorm);
    return (fromIsMe && toIsOther) || (fromIsOther && toIsMe);
  });

  if (matches.length === 0) return { status: "none" };

  // Always prioritize accepted connection
  const accepted = matches.find((m) => m.status === "accepted");
  if (accepted) {
    return { status: "connected", connection: accepted };
  }

  const pending = matches.find((m) => m.status === "pending");
  if (pending) {
    if (myNorms.includes(pending.fromUserId.toLowerCase().trim())) {
      return { status: "pending_sent", connection: pending };
    }
    return { status: "pending_received", connection: pending };
  }

  return { status: "none", connection: matches[0] };
}

export async function sendConnectionRequest(params: {
  fromUser: {
    id: string;
    name: string;
    role: NetworkRole;
    roleLabel: string;
    city: string;
  };
  toUser: {
    id: string;
    name: string;
    role: NetworkRole;
    roleLabel?: string;
    city?: string;
  };
  note?: string;
}): Promise<ConnectionRecord> {
  const local = getLocalConnections();

  // Check if connection already exists
  const existing = local.find(
    (c) =>
      (c.fromUserId === params.fromUser.id && c.toUserId === params.toUser.id) ||
      (c.fromUserId === params.toUser.id && c.toUserId === params.fromUser.id)
  );

  if (existing) {
    if (existing.status === "accepted") {
      throw new Error("You are already connected with this member.");
    }
    if (existing.status === "pending") {
      throw new Error("A connection request is already pending.");
    }
  }

  let newConnId = `CONN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // 1. Send peer connection to TRANA backend database
  try {
    const res = await fetch(`${API_URL}/api/network/connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_user_id: params.fromUser.id,
        from_user_name: params.fromUser.name,
        from_user_role: params.fromUser.role,
        from_user_role_label: params.fromUser.roleLabel || "Verified Advocate",
        from_user_city: params.fromUser.city || "New Delhi",
        to_user_id: params.toUser.id,
        to_user_name: params.toUser.name,
        to_user_role: params.toUser.role,
        to_user_role_label: params.toUser.roleLabel || "Verified Advocate",
        to_user_city: params.toUser.city || "New Delhi",
        note: params.note || "",
      }),
    });
    if (res.ok) {
      const dbConn = await res.json();
      if (dbConn?.id) newConnId = dbConn.id;
    }
  } catch (backendErr) {
    console.warn("Backend peer connection request error:", backendErr);
  }

  // 2. Sync to Supabase consultations for cross-platform replication
  try {
    const basePayload = {
      user_id: params.fromUser.id,
      lawyer_name: params.toUser.name,
      consult_type: "peer_connection",
      status: "pending",
      note: JSON.stringify({
        fromUserId: params.fromUser.id,
        fromUserName: params.fromUser.name,
        fromUserRole: params.fromUser.role,
        fromUserRoleLabel: params.fromUser.roleLabel,
        fromUserCity: params.fromUser.city,
        toUserId: params.toUser.id,
        toUserName: params.toUser.name,
        toUserRole: params.toUser.role,
        toUserRoleLabel: params.toUser.roleLabel || "Member",
        toUserCity: params.toUser.city || "New Delhi",
        note: params.note || "",
      }),
      intake_brief: `Connection Request from ${params.fromUser.name} (${params.fromUser.roleLabel}) to ${params.toUser.name}`,
    };

    let inserted: any = null;
    const { data: firstTry, error: err1 } = await supabase
      .from("consultations")
      .insert({ ...basePayload, lawyer_id: params.toUser.id })
      .select("id")
      .maybeSingle();

    if (!err1 && firstTry?.id) {
      inserted = firstTry;
    } else {
      // Fallback if foreign key check failed on lawyer_id
      const { data: retryTry } = await supabase
        .from("consultations")
        .insert({ ...basePayload, lawyer_id: null })
        .select("id")
        .maybeSingle();
      inserted = retryTry;
    }

    if (inserted?.id) {
      newConnId = `CONN-${inserted.id}`;
    }
  } catch (err) {
    console.warn("Supabase peer_connection insert error:", err);
  }

  const newConn: ConnectionRecord = {
    id: newConnId,
    fromUserId: params.fromUser.id,
    fromUserName: params.fromUser.name,
    fromUserRole: params.fromUser.role,
    fromUserRoleLabel: params.fromUser.roleLabel,
    fromUserCity: params.fromUser.city,
    toUserId: params.toUser.id,
    toUserName: params.toUser.name,
    toUserRole: params.toUser.role,
    toUserRoleLabel: params.toUser.roleLabel,
    toUserCity: params.toUser.city,
    status: "pending",
    note: params.note,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  local.unshift(newConn);
  saveLocalConnections(local);
  return newConn;
}

export async function acceptConnectionRequest(connectionId: string): Promise<void> {
  const local = getLocalConnections();
  const index = local.findIndex((c) => c.id === connectionId);

  if (index === -1) {
    throw new Error("Connection request not found.");
  }

  const conn = local[index];
  conn.status = "accepted";
  conn.updatedAt = new Date().toISOString();
  saveLocalConnections(local);

  // 1. Sync accepted status to TRANA backend
  try {
    await fetch(`${API_URL}/api/network/connections/${encodeURIComponent(conn.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ACCEPT" }),
    });
  } catch (backendErr) {
    console.warn("Backend acceptConnectionRequest error:", backendErr);
  }

  // 2. Establish chat channel for both parties
  const chatKey = `trana_consult_chat_${conn.id}`;
  const initialMessages = [
    {
      id: `msg-conn-${Date.now()}`,
      sender: "system",
      senderName: "TRANA Professional Relay",
      text: `Connection accepted! You and ${conn.fromUserName} are now connected. You can exchange legal research, discuss litigation topics, or collaborate directly.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ];
  try {
    localStorage.setItem(chatKey, JSON.stringify(initialMessages));
    const chatIndex = JSON.parse(localStorage.getItem("trana_all_consultation_chats_index") || "{}");
    chatIndex[conn.id] = {
      consultationId: conn.id,
      clientName: conn.fromUserName,
      lawyerName: conn.toUserName,
      consultationType: "Peer",
      status: "Confirmed",
      lastMessage: "Connected via Professional Network",
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem("trana_all_consultation_chats_index", JSON.stringify(chatIndex));
    window.dispatchEvent(new Event("trana_consult_chat_update"));
  } catch {}

  // Update Supabase consultations table with confirmed status
  try {
    const rawId = connectionId.replace(/^CONN-/, "");
    await supabase
      .from("consultations")
      .update({
        status: "confirmed",
        note: JSON.stringify({ ...conn, status: "accepted" }),
      })
      .or(`id.eq.${rawId},and(user_id.eq.${conn.fromUserId},lawyer_id.eq.${conn.toUserId}),and(user_id.eq.${conn.toUserId},lawyer_id.eq.${conn.fromUserId})`);
  } catch (err) {
    console.warn("acceptConnectionRequest Supabase update error:", err);
  }

  // Also insert or upsert confirmation record under accepting user's auth
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      await supabase.from("consultations").insert({
        user_id: authData.user.id,
        lawyer_name: conn.fromUserName || conn.toUserName || "Professional Colleague",
        consult_type: "peer_connection",
        status: "confirmed",
        note: JSON.stringify({
          ...conn,
          status: "accepted",
          acceptedBy: authData.user.id,
          updatedAt: new Date().toISOString(),
        }),
        intake_brief: `Accepted Connection between ${conn.fromUserName} and ${conn.toUserName}`,
      });
    }
  } catch (err) {
    console.warn("acceptConnectionRequest confirmation insert error:", err);
  }
}

export async function declineConnectionRequest(connectionId: string): Promise<void> {
  const local = getLocalConnections();
  const index = local.findIndex((c) => c.id === connectionId);
  const conn = index !== -1 ? local[index] : null;

  const updated = local.filter((c) => c.id !== connectionId);
  saveLocalConnections(updated);

  try {
    await fetch(`${API_URL}/api/network/connections/${encodeURIComponent(connectionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DECLINE" }),
    });
  } catch {}

  try {
    const rawId = connectionId.replace(/^CONN-/, "");
    if (conn) {
      await supabase
        .from("consultations")
        .update({ status: "denied" })
        .or(`id.eq.${rawId},and(user_id.eq.${conn.fromUserId},lawyer_id.eq.${conn.toUserId}),and(user_id.eq.${conn.toUserId},lawyer_id.eq.${conn.fromUserId})`);
    } else {
      await supabase.from("consultations").delete().eq("id", rawId);
    }
  } catch {}
}

export async function removeConnection(connectionId: string): Promise<void> {
  const local = getLocalConnections();
  const index = local.findIndex((c) => c.id === connectionId);
  const conn = index !== -1 ? local[index] : null;

  const updated = local.filter((c) => c.id !== connectionId);
  saveLocalConnections(updated);

  try {
    await fetch(`${API_URL}/api/network/connections/${encodeURIComponent(connectionId)}`, {
      method: "DELETE",
    });
  } catch {}

  try {
    const rawId = connectionId.replace(/^CONN-/, "");
    if (conn) {
      await supabase
        .from("consultations")
        .update({ status: "cancelled" })
        .or(`id.eq.${rawId},and(user_id.eq.${conn.fromUserId},lawyer_id.eq.${conn.toUserId}),and(user_id.eq.${conn.toUserId},lawyer_id.eq.${conn.fromUserId})`);
    }
  } catch {}
}

