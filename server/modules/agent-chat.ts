/**
 * Agent-to-Agent Chat — Internal agent messaging system
 * Agents can send messages, share drafts, request reviews, @mention
 */

import type { Express } from "express";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentMessage {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string | null; // null = broadcast to department
  toDepartmentId: string | null;
  content: string;
  type: "message" | "draft" | "review_request" | "review_response" | "task_handoff";
  taskId: string | null;
  mentions: string[]; // agent IDs mentioned with @
  timestamp: number;
  read: boolean;
}

// In-memory message store (max 500 messages)
const messages: AgentMessage[] = [];
const MAX_MESSAGES = 500;

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sendAgentMessage(opts: {
  fromAgentId: string;
  fromAgentName: string;
  toAgentId?: string;
  toDepartmentId?: string;
  content: string;
  type?: AgentMessage["type"];
  taskId?: string;
}): AgentMessage {
  // Extract @mentions
  const mentionMatches = opts.content.match(/@(\w+)/g) || [];
  const mentions = mentionMatches.map(m => m.slice(1));

  const msg: AgentMessage = {
    id: generateId(),
    fromAgentId: opts.fromAgentId,
    fromAgentName: opts.fromAgentName,
    toAgentId: opts.toAgentId || null,
    toDepartmentId: opts.toDepartmentId || null,
    content: opts.content,
    type: opts.type || "message",
    taskId: opts.taskId || null,
    mentions,
    timestamp: Date.now(),
    read: false,
  };

  messages.push(msg);
  
  // Keep only latest messages
  while (messages.length > MAX_MESSAGES) {
    messages.shift();
  }

  return msg;
}

export function getAgentMessages(agentId: string, limit = 50): AgentMessage[] {
  return messages
    .filter(m => 
      m.toAgentId === agentId || 
      m.fromAgentId === agentId || 
      m.mentions.includes(agentId)
    )
    .slice(-limit);
}

export function getDepartmentMessages(departmentId: string, limit = 50): AgentMessage[] {
  return messages
    .filter(m => m.toDepartmentId === departmentId)
    .slice(-limit);
}

export function getAllMessages(limit = 100): AgentMessage[] {
  return messages.slice(-limit);
}

export function getUnreadCount(agentId: string): number {
  return messages.filter(m => 
    !m.read && 
    m.fromAgentId !== agentId &&
    (m.toAgentId === agentId || m.mentions.includes(agentId))
  ).length;
}

export function markAsRead(agentId: string): void {
  for (const m of messages) {
    if (m.toAgentId === agentId || m.mentions.includes(agentId)) {
      m.read = true;
    }
  }
}

// Auto-message: when a task completes, notify relevant agents
export function notifyTaskCompletion(agentId: string, agentName: string, taskTitle: string, taskId: string, result: string): void {
  sendAgentMessage({
    fromAgentId: agentId,
    fromAgentName: agentName,
    content: `✅ เสร็จแล้ว: "${taskTitle}"\n\n${result.slice(0, 200)}${result.length > 200 ? "..." : ""}`,
    type: "task_handoff",
    taskId,
  });
}

// Auto-message: request review from another agent
export function requestReview(fromId: string, fromName: string, toId: string, taskTitle: string, taskId: string, draft: string): void {
  sendAgentMessage({
    fromAgentId: fromId,
    fromAgentName: fromName,
    toAgentId: toId,
    content: `📝 ขอ Review: "${taskTitle}"\n\n${draft.slice(0, 300)}${draft.length > 300 ? "..." : ""}`,
    type: "review_request",
    taskId,
  });
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAgentChatRoutes(app: Express): void {
  // Send a message
  app.post("/api/agent-chat/send", (req, res) => {
    const { fromAgentId, fromAgentName, toAgentId, toDepartmentId, content, type, taskId } = req.body || {};
    if (!fromAgentId || !content) {
      return res.status(400).json({ ok: false, error: "fromAgentId and content required" });
    }
    const msg = sendAgentMessage({
      fromAgentId,
      fromAgentName: fromAgentName || fromAgentId,
      toAgentId,
      toDepartmentId,
      content,
      type,
      taskId,
    });
    res.json({ ok: true, message: msg });
  });

  // Get messages for an agent
  app.get("/api/agent-chat/:agentId/messages", (req, res) => {
    const msgs = getAgentMessages(req.params.agentId);
    res.json({ ok: true, messages: msgs, total: msgs.length });
  });

  // Get department messages
  app.get("/api/agent-chat/department/:deptId/messages", (req, res) => {
    const msgs = getDepartmentMessages(req.params.deptId);
    res.json({ ok: true, messages: msgs, total: msgs.length });
  });

  // Get all messages (feed)
  app.get("/api/agent-chat/feed", (_req, res) => {
    const msgs = getAllMessages();
    res.json({ ok: true, messages: msgs, total: msgs.length });
  });

  // Get unread count
  app.get("/api/agent-chat/:agentId/unread", (req, res) => {
    const count = getUnreadCount(req.params.agentId);
    res.json({ ok: true, unread: count });
  });

  // Mark as read
  app.post("/api/agent-chat/:agentId/read", (req, res) => {
    markAsRead(req.params.agentId);
    res.json({ ok: true });
  });

  console.log("[Agent Chat] ✅ Internal messaging system ready");
}
