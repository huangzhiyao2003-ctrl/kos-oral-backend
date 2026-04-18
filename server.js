import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { buildPromptV2 } from "./prompt-config-v2.js";

dotenv.config();

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com"
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/generate", async (req, res) => {
  try {
    const {
      spu,
      contentGroup,
      contentAngle,
      format,
      persona,
      goal,
      pain,
      selling
    } = req.body || {};

    if (!spu || !contentGroup || !contentAngle || !format || !persona || !goal || !pain) {
      return res.status(400).json({
        ok: false,
        error: "missing_required_fields"
      });
    }

    const prompt = buildPromptV2({
      spu,
      contentGroup,
      contentAngle,
      format,
      persona,
      goal,
      pain,
      selling: selling || ""
    });

    const systemInstruction = `
你必须只输出合法 JSON，不要输出 markdown 代码块，不要输出解释。
如果用户要求的是图文，输出格式必须是：
{
  "titles": ["标题1", "标题2", "标题3"],
  "coverText": "封面文案",
  "body": "正文",
  "commentCTA": "评论区引导",
  "usageNote": "使用提醒"
}

如果用户要求的是视频，输出格式必须是：
{
  "titles": ["标题1", "标题2", "标题3"],
  "hook": "开头3秒",
  "script": "完整视频脚本",
  "commentCTA": "评论区引导",
  "usageNote": "使用提醒"
}
`;

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      return res.status(500).json({
        ok: false,
        error: "empty_model_response"
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw
        .replace(/^```json\\s*/i, "")
        .replace(/^```\\s*/i, "")
        .replace(/```\\s*$/i, "")
        .trim();

      parsed = JSON.parse(cleaned);
    }

    if (format === "video") {
      if (
        !Array.isArray(parsed.titles) ||
        !parsed.hook ||
        !parsed.script ||
        !parsed.commentCTA ||
        !parsed.usageNote
      ) {
        return res.status(500).json({
          ok: false,
          error: "invalid_video_response_shape",
          raw: parsed
        });
      }
    } else {
      if (
        !Array.isArray(parsed.titles) ||
        !parsed.coverText ||
        !parsed.body ||
        !parsed.commentCTA ||
        !parsed.usageNote
      ) {
        return res.status(500).json({
          ok: false,
          error: "invalid_post_response_shape",
          raw: parsed
        });
      }
    }

    return res.json({
      ok: true,
      data: parsed
    });
  } catch (err) {
    console.error("DEEPSEEK_ERROR_DETAIL:", err);

    return res.status(500).json({
      ok: false,
      error: "generation_failed",
      message: err?.message || "unknown_error",
      status: err?.status || null
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
