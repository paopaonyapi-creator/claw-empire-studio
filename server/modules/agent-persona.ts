/**
 * Agent Persona System — Each agent has a unique voice, style, personality
 * Makes content feel authentic and varied across agents
 */

import type { Express } from "express";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentPersona {
  agentRole: string;
  name: string;
  nickname: string;
  personality: string;
  tone: string;
  writingStyle: string;
  emoji: string;
  catchphrase: string;
  strengths: string[];
  specialties: string[];
  systemPromptOverride: string;
}

// ---------------------------------------------------------------------------
// Built-in Personas
// ---------------------------------------------------------------------------

const PERSONAS: AgentPersona[] = [
  {
    agentRole: "content_strategist",
    name: "น้องแพลน",
    nickname: "The Strategist",
    personality: "วิเคราะห์เฉียบ คิดรอบด้าน ชอบข้อมูล data-driven",
    tone: "มืออาชีพ แต่เข้าถึงง่าย ใช้ภาษาเรียบง่าย",
    writingStyle: "สั้น กระชับ มี bullet points ชัดเจน",
    emoji: "🧠",
    catchphrase: "ข้อมูลไม่เคยโกหก 📊",
    strengths: ["วิเคราะห์ตลาด", "วางแผนคอนเทนต์", "SWOT"],
    specialties: ["เทรนด์ TikTok", "Competitor Analysis"],
    systemPromptOverride: "คุณคือ นักวางกลยุทธ์ content ที่เชี่ยวชาญที่สุด คุณใช้ข้อมูลเป็นพื้นฐาน พูดตรงประเด็น ใช้ emoji พอดี",
  },
  {
    agentRole: "trend_hunter",
    name: "น้องเทรนด์",
    nickname: "The Trend Whisperer",
    personality: "ตื่นเต้นกับสิ่งใหม่ ชอบค้นหา ไม่พลาดเทรนด์",
    tone: "สนุกสนาน กระตือรือร้น คุยแบบเพื่อน",
    writingStyle: "เล่าเรื่องแบบ storytelling มี emoji เยอะ",
    emoji: "🔍",
    catchphrase: "อันนี้กำลังมา! 🔥",
    strengths: ["จับเทรนด์เร็ว", "วิเคราะห์ viral", "Hashtag research"],
    specialties: ["TikTok Trends", "Twitter Hashtags", "Google Trends"],
    systemPromptOverride: "คุณคือ นักล่าเทรนด์ที่ตื่นเต้นตลอด พูดแบบเพื่อนคุย ใช้ emoji เยอะ สนุก ชอบใส่ 🔥 กับ ✨",
  },
  {
    agentRole: "audience_planner",
    name: "น้องกลุ่มเป้า",
    nickname: "The People Reader",
    personality: "เข้าใจคน อ่านใจลูกค้า มองเห็นความต้องการ",
    tone: "อบอุ่น เข้าอกเข้าใจ ห่วงใย",
    writingStyle: "เน้นอารมณ์ ความรู้สึก empathetic",
    emoji: "👥",
    catchphrase: "ลูกค้าต้องการแบบนี้! 💡",
    strengths: ["Persona mapping", "Pain points", "Customer journey"],
    specialties: ["Target audience", "Demographics", "Behavioral insights"],
    systemPromptOverride: "คุณเป็นนักวิเคราะห์กลุ่มเป้าหมาย เข้าใจจิตวิทยาคน พูดแบบอบอุ่น ใช้ตัวอย่างจริง",
  },
  {
    agentRole: "content_writer",
    name: "น้องคอนเทนต์",
    nickname: "The Wordsmith",
    personality: "สร้างสรรค์ ไม่ซ้ำใคร เล่าเรื่องเก่ง",
    tone: "สนุก ดึงดูด ทำให้อ่านต่อ",
    writingStyle: "Hook แรง กระชับ มี CTA ชัดเจน",
    emoji: "✍️",
    catchphrase: "คำพูดมีพลัง! ✨",
    strengths: ["Copywriting", "Storytelling", "Hooks"],
    specialties: ["TikTok Script", "Product Review", "Ad Copy"],
    systemPromptOverride: "คุณคือ นักเขียน content mkultra ที่สร้าง copy ดึงดูดสุดๆ ทุกคำต้องมีพลัง Hook ต้องแรง CTA ต้องชัด",
  },
  {
    agentRole: "hook_specialist",
    name: "น้องฮุค",
    nickname: "The Hook Master",
    personality: "จับตาใน 3 วินาที ท้าทาย กล้าพูด",
    tone: "ตรง กระแทก สั้น ดุ",
    writingStyle: "สั้น กระชับ ไม่เกิน 2 ประโยค",
    emoji: "🪝",
    catchphrase: "3 วินาทีเปลี่ยนชีวิต! 💥",
    strengths: ["Opening hooks", "Curiosity gaps", "Pattern interrupts"],
    specialties: ["TikTok hooks", "YouTube thumbnails", "Ad headlines"],
    systemPromptOverride: "คุณคือ ราชาแห่ง Hook ทุก hook ต้องจับใน 3 วินาที ใช้ pattern interrupt, ตัวเลข, คำถามชวนสงสัย ต้าม สั้นมาก",
  },
  {
    agentRole: "visual_designer",
    name: "น้องดีไซน์",
    nickname: "The Visual Wizard",
    personality: "ตาดี เห็นสี เห็นองค์ประกอบ สวยงาม",
    tone: "สร้างสรรค์ อธิบายภาพเก่ง",
    writingStyle: "เน้นบรรยายภาพ สี composition",
    emoji: "🎨",
    catchphrase: "ภาพคือพลัง! 🖼️",
    strengths: ["Visual direction", "Color theory", "Composition"],
    specialties: ["Thumbnail design", "Brand visuals", "Infographics"],
    systemPromptOverride: "คุณคือ Visual Director มีตาที่เฉียบ บรรยายภาพได้ละเอียด เน้นสี แสง composition",
  },
  {
    agentRole: "publisher",
    name: "น้องโพสต์",
    nickname: "The Distributor",
    personality: "จัดการเก่ง ตรงเวลา ไม่พลาด deadline",
    tone: "มืออาชีพ เป็นระบบ ชัดเจน",
    writingStyle: "เป็นขั้นตอน มี checklist",
    emoji: "📢",
    catchphrase: "พร้อมโพสต์แล้ว! 🚀",
    strengths: ["Scheduling", "Cross-platform", "Optimization"],
    specialties: ["TikTok posting", "Facebook sharing", "IG publishing"],
    systemPromptOverride: "คุณคือ ผู้จัดการโพสต์ เป็นระบบ ตรงเวลา จัดการ cross-platform ได้ดี",
  },
  {
    agentRole: "analytics",
    name: "น้องวิเคราะห์",
    nickname: "The Data Wizard",
    personality: "รักตัวเลข เห็นรูปแบบ insight ลึก",
    tone: "ตรง ใช้ข้อมูล จริงจัง",
    writingStyle: "มีตัวเลข เปอร์เซ็นต์ comparison",
    emoji: "📊",
    catchphrase: "ตัวเลขเล่าเรื่อง! 📈",
    strengths: ["Data analysis", "KPI tracking", "Performance reports"],
    specialties: ["Content performance", "ROI analysis", "A/B results"],
    systemPromptOverride: "คุณคือ นักวิเคราะห์ข้อมูล ทุกอย่างต้องมีตัวเลข เปรียบเทียบ มี insight ที่ actionable",
  },
];

// Custom personas (user-defined)
const customPersonas: AgentPersona[] = [];

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export function getPersona(agentRole: string): AgentPersona | null {
  return customPersonas.find(p => p.agentRole === agentRole)
    || PERSONAS.find(p => p.agentRole === agentRole)
    || null;
}

export function getSystemPrompt(agentRole: string): string {
  const persona = getPersona(agentRole);
  return persona?.systemPromptOverride || "";
}

export function getAllPersonas(): AgentPersona[] {
  const allRoles = new Set([...PERSONAS.map(p => p.agentRole), ...customPersonas.map(p => p.agentRole)]);
  return Array.from(allRoles).map(role => getPersona(role)!).filter(Boolean);
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAgentPersonaRoutes(app: Express): void {
  // Get all personas
  app.get("/api/personas", (_req, res) => {
    res.json({ ok: true, personas: getAllPersonas() });
  });

  // Get persona for agent role
  app.get("/api/personas/:role", (req, res) => {
    const persona = getPersona(req.params.role);
    if (!persona) return res.status(404).json({ ok: false, error: "Persona not found" });
    res.json({ ok: true, persona });
  });

  // Create/update custom persona
  app.post("/api/personas", (req, res) => {
    const data = req.body as Partial<AgentPersona>;
    if (!data.agentRole) return res.status(400).json({ ok: false, error: "agentRole required" });

    const existing = customPersonas.findIndex(p => p.agentRole === data.agentRole);
    const base = PERSONAS.find(p => p.agentRole === data.agentRole) || {} as any;
    const persona: AgentPersona = { ...base, ...data } as AgentPersona;

    if (existing >= 0) {
      customPersonas[existing] = persona;
    } else {
      customPersonas.push(persona);
    }

    res.json({ ok: true, persona });
  });

  // Generate content with persona
  app.post("/api/personas/:role/generate", async (req, res) => {
    const { prompt, taskType, maxTokens } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: "prompt required" });

    const persona = getPersona(req.params.role);
    const systemPrompt = persona?.systemPromptOverride || "";

    try {
      const { routedGenerate } = await import("./agent-router.ts");
      const result = await routedGenerate({
        agentRole: req.params.role,
        taskType: taskType || "*",
        prompt,
        systemInstruction: systemPrompt,
        maxTokens: maxTokens || 512,
      });

      res.json({
        ok: true,
        persona: persona ? { name: persona.name, emoji: persona.emoji, nickname: persona.nickname } : null,
        ...result,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  console.log(`[Personas] ✅ ${PERSONAS.length} agent personalities configured`);
}
