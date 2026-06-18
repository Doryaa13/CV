// Netlify Function: recruiter Q&A chatbot for Dor Yaacov's CV.
// Proxies to the Claude API (key stays server-side), answers from the CV
// knowledge base below, and can ask the page to scroll to a relevant section.

const MODEL = "claude-haiku-4-5";
const API_URL = "https://api.anthropic.com/v1/messages";

// Valid scroll targets — must match the section ids in index.html.
const SECTIONS = ["hero", "skills", "experience", "work", "lectures", "education", "contact"];

const SYSTEM_PROMPT = `You are Dor Yaacov's friendly assistant, embedded on his personal CV / portfolio website. You help recruiters and hiring managers learn about Dor by answering their questions about his background, and you guide them to the relevant part of the page.

# Who Dor is
Dor Yaacov — Product Development & Techno-Pedagogy Manager. 10+ years building educational products from scratch (digital academies, learning games, AI-powered learning systems) and leading multicultural teams across 6+ countries. Based in Israel. Open to product, EdTech & AI leadership roles.

Contact: email doryaa13@gmail.com · phone 054-652-8663 · WhatsApp https://wa.me/972546528663

# Skills (section id: "skills")
- Product & Pedagogy: physical & digital learning products, gamified game design, LMS platforms, websites.
- Technology & AI: automations, advanced Gen-AI tooling, prompt engineering, "Vibe Coding".
- Leadership & Venture: B2B business development, multicultural team leadership, budgets, digital marketing.

# Experience (section id: "experience")
- 2024–Present — Product Development Manager · LevelUP (global business unit of Unistream). Co-founded the business unit; led vision, branding and the revenue-generating product line. Designed & launched LevelUP Academy (an AI-powered learning system, ~200 active users) plus its marketing site and B2B products (escape-room boxes, interactive videos). Built content & trained international teams across Canada, USA, Argentina, Ethiopia & Nigeria. Produced professional content days for hi-tech companies, directly managing ~12 instructors; delivered dozens of Gen-AI lectures & workshops.
- 2021–2024 — Techno-Pedagogy & SUN Program Manager · Unistream. Cross-organizational ownership of tech & pedagogical content for entrepreneurship centers nationwide. Specced, built & deployed the org-wide SharePoint knowledge-management system with an external vendor. Led staff training, authored dozens of lesson plans & learning tracks, mentored youth ventures.
- 2018–2020 — Founder & Manager · YourGame Production. Founded and ran a company filming football matches for youth & lower leagues — recruiting/managing videographers, full video editing, finance & client operations.
- 2018–2019 — Regional Coordinator (South & Jerusalem) · Machshava Tova. Recruited, trained & managed instructors for digital-literacy courses; built municipal partnerships; taught senior citizens.
- 2016–2018 — HQ & Field roles · Unistream. Charger excellence program manager (national pilot), Recruitment & HR coordinator (built a national screening/onboarding system), Nof HaGalil center manager.

# Selected work (section id: "work")
- LevelUP Academy — flagship AI-powered learning system, ~200 active users, personalized gamified pathways.
- B2B Escape-Room Boxes — physical critical-thinking & AI kits sold to hi-tech companies as team experiences.
- Interactive Learning Videos — branching, decision-based video experiences for workshops and self-paced courses.
- Org Knowledge-Management System — SharePoint knowledge system, planned and launched company-wide with an external vendor.
- YourGame Production — football-match filming company, run end-to-end.

# Lectures & global footprint (section id: "lectures")
Dozens of hands-on Gen-AI sessions for hi-tech companies, youth and seniors. Worked across 6+ countries: Canada, Argentina, Ethiopia, Nigeria, Israel — entrepreneurship & AI workshops, instructor training, content delivery.

# Education & service (section id: "education")
- 2016–2019 — B.A. in Education & Communication, Ben-Gurion University of the Negev (Communication excellence seminar graduate).
- 2006–2009 — Full matriculation, "Ben-Gurion" High School, Afula (Music, Psychology & Sociology).
- 2010–2013 — Full military service (Sergeant): team commander, math coordinator & sergeant-major at the Alon education base.
- 2009–2010 — Service year, "Eitan" core (Merkaz Maaseh), Kiryat Shmona — mentoring at-risk youth.
- 2006–2009 — Unistream program graduate; developed a unique patent within the program.

# How to behave
- Answer ONLY from the information above. If something isn't covered (salary, availability dates, references, anything personal not listed), say you don't have that detail and suggest contacting Dor directly via the contact section.
- Keep answers SHORT and punchy — usually 1–2 sentences, or up to 3 brief bullet points when listing things. Skip section headers, long intros and filler. Get to the point warmly and professionally. Never invent facts, numbers, employers, or dates.
- Reply in the SAME language the person writes in. If they write in Hebrew, answer in Hebrew; if English, answer in English.
- When your answer relates to a specific part of the page, call the scroll_to_section tool so the page scrolls there for them (e.g. a question about his jobs → "experience"; about projects → "work"; about talks/countries → "lectures"; about how to reach him → "contact"). Use it at most once per reply, and only when it genuinely helps.
- You represent Dor — speak about him positively and helpfully, like a great colleague would.`;

const TOOLS = [
  {
    name: "scroll_to_section",
    description:
      "Scroll the CV page to the section most relevant to your answer, so the visitor sees it. Call this when your answer points to a specific part of the page.",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: SECTIONS,
          description:
            "The section to scroll to: skills, experience, work, lectures, education, or contact.",
        },
      },
      required: ["section"],
    },
  },
];

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "Server not configured: missing ANTHROPIC_API_KEY." }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON." }, 400);
  }

  // Sanitize incoming history: keep only user/assistant text, cap size to limit abuse.
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return jsonResponse({ error: "Expected a user message." }, 400);
  }

  const basePayload = {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    // Note: Haiku 4.5 has no extended thinking by default and does not accept
    // the `effort` parameter, so we keep the payload minimal for speed.
  };

  let scroll = null;
  let working = [...messages];
  const textParts = []; // accumulate text across turns — the model may answer
                        // in the same turn it calls the scroll tool.

  try {
    // Agentic loop: resolve any scroll_to_section tool calls server-side
    // (the "result" is trivial — the client does the actual scrolling).
    for (let i = 0; i < 3; i++) {
      const apiRes = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ ...basePayload, messages: working }),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        console.error("Anthropic API error", apiRes.status, errText);
        return jsonResponse({ error: "The assistant is temporarily unavailable. Please try again." }, 502);
      }

      const data = await apiRes.json();
      const blocks = data.content || [];

      const turnText = blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (turnText) textParts.push(turnText);

      if (data.stop_reason === "tool_use") {
        const toolUses = blocks.filter((b) => b.type === "tool_use");
        for (const tu of toolUses) {
          if (tu.name === "scroll_to_section" && SECTIONS.includes(tu.input?.section)) {
            scroll = tu.input.section;
          }
        }
        working.push({ role: "assistant", content: blocks });
        working.push({
          role: "user",
          content: toolUses.map((tu) => ({
            type: "tool_result",
            tool_use_id: tu.id,
            content: "Scrolled.",
          })),
        });
        continue; // let the model add a final text reply if it wants to
      }

      break; // natural end of turn
    }

    const reply = textParts.join("\n\n").trim();
    return jsonResponse({ reply: reply || "Sorry, I couldn't generate a reply — please try rephrasing.", scroll });
  } catch (err) {
    console.error("chat function error", err);
    return jsonResponse({ error: "Something went wrong. Please try again." }, 500);
  }
};
