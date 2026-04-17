import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { buildPromptV2, getJsonSchema } from "./prompt-config-v2.js";

dotenv.config();

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "content_output",
          schema: getJsonSchema(format)
        }
      },
      reasoning: {
        effort: "medium"
      }
    });

    const data = JSON.parse(response.output_text);

    return res.json({
      ok: true,
      data
    });
  } catch (err) {
    console.error("OPENAI_ERROR_DETAIL:", err);

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
