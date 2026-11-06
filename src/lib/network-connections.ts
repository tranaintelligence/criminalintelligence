import { supabase } from "@/integrations/supabase/client";

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

  // Also query Supabase consultations where consult_type = 'peer_connection'
  try {
    const { data: dbRows } = await supabase
      .from("consultations")
      .select("*")
      .eq("consult_type", "peer_connection")
      .order("created_at", { ascending: false });

    if (dbRows && dbRows.length > 0) {
      dbRows.forEach((row) => {
        let meta: any = {};
        try {
          if (row.note) meta = JSON.parse(row.note);
        } catch {}

        const connId = `CONN-${row.id}`;
        if (!local.some((c) => c.id === connId)) {
          const fromId = meta.fromUserId || row.user_id;
          const toId = meta.toUserId || row.lawyer_id;
          const st = row.status === "confirmed" || row.status === "accepted" ? "accepted" : "pending";

          local.push({
            id: connId,
            fromUserId: fromId,
            fromUserName: meta.fromUserName || "Professional Member",
            fromUserRole: meta.fromUserRole || "lawyer",
            fromUserRoleLabel: meta.fromUserRoleLabel || "Member",
            fromUserCity: meta.fromUserCity || "New Delhi",
            toUserId: toId,
            toUserName: meta.toUserName || row.lawyer_name || "Colleague",
            toUserRole: meta.toUserRole || "lawyer",
            status: st,
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.created_at || new Date().toISOString(),
          });
        }
      });
      saveLocalConnections(local);
    }
  } catch {}

  return local;
}

export function getConnectionStatusBetween(
  connections: ConnectionRecord[],
  myId: string,
  otherId: string
): { status: ConnectionStatus; connection?: ConnectionRecord } {
  const myNorm = myId.toLowerCase().trim();
  const otherNorm = otherId.toLowerCase().trim();

  const found = connections.find((c) => {
    const fromNorm = c.fromUserId.toLowerCase().trim();
    const toNorm = c.toUserId.toLowerCase().trim();
    return (
      (fromNorm === myNorm && toNorm === otherNorm) ||
      (fromNorm === otherNorm && toNorm === myNorm)
    );
  });

  if (!found) return { status: "none" };

  if (found.status === "accepted") {
    return { status: "connected", connection: found };
  }

  if (found.status === "pending") {
    if (found.fromUserId.toLowerCase().trim() === myNorm) {
      return { status: "pending_sent", connection: found };
    }
    return { status: "pending_received", connection: found };
  }

  return { status: "none", connection: found };
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

  const newConn: ConnectionRecord = {
    id: `CONN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

  // Sync to Supabase consultations for cross-account notification
  try {
    await supabase.from("consultations").insert({
      user_id: params.fromUser.id,
      lawyer_id: params.toUser.id,
      lawyer_name: params.toUser.name,
      consult_type: "peer_connection",
      status: "pending",
      note: JSON.stringify(newConn),
      intake_brief: `Connection Request from ${params.fromUser.name} (${params.fromUser.roleLabel}) to ${params.toUser.name}`,
    });
  } catch {}

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

  // Also establish chat channel
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
  } catch {}

  // Update Supabase if exists
  try {
    const rawId = connectionId.replace(/^CONN-/, "");
    await supabase
      .from("consultations")
      .update({ status: "confirmed" })
      .or(`id.eq.${rawId},user_id.eq.${conn.fromUserId}`);
  } catch {}
}

export async function declineConnectionRequest(connectionId: string): Promise<void> {
  const local = getLocalConnections();
  const updated = local.filter((c) => c.id !== connectionId);
  saveLocalConnections(updated);

  try {
    const rawId = connectionId.replace(/^CONN-/, "");
    await supabase.from("consultations").delete().eq("id", rawId);
  } catch {}
}

export async function removeConnection(connectionId: string): Promise<void> {
  const local = getLocalConnections();
  const updated = local.filter((c) => c.id !== connectionId);
  saveLocalConnections(updated);
}

