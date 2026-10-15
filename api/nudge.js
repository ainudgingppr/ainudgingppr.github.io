const DEFAULT_GEMINI_KEY = (process.env.GEMINI_API_KEY || "").trim();
const DEFAULT_HF_KEY = (process.env.HF_API_KEY || "").trim();

const GEMINI_MODEL = "gemini-3.5-flash";
const HF_MODEL = "Qwen/Qwen2.5-72B-Instruct";

function buildNudgePrompt(product, productInfo, userPreference) {
    return `
You are an expert in behavioral economics and ethical AI nudging for grocery shopping.

Product Selected: "${product}"
Reference Product Attributes & Context: ${JSON.stringify(productInfo || {})}
User's Natural Language Preference: "${userPreference}"

Task:
Write a concise, natural, and persuasive 2-to-3 sentence nudge message for this product tailored specifically to the user's preference, grounded in the product's real attributes.

Rules:
Output PLAIN TEXT only. No markdown, no quotes, no bullet points, and no extra explanation.
`.trim();
}

async function callGemini(promptText, apiKey) {
    if (!apiKey) {
        throw new Error("Missing Gemini API Key. Please enter your Gemini API Key in the toolkit.");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
        })
    });

    const rawText = await response.text();
    if (!response.ok) {
        throw new Error(`Gemini API Error (${response.status}): ${rawText}`);
    }

    const data = JSON.parse(rawText);
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (!content) {
        throw new Error("Empty response from Gemini API.");
    }
    return content.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").replace(/^["']\vert{}["']$/g, "").trim();
}

async function callHuggingFace(promptText, apiKey) {
    if (!apiKey) {
        throw new Error("Missing Hugging Face API Key. Please enter your Hugging Face token (hf_...) in the toolkit.");
    }

    const endpoint = "https://router.huggingface.co/v1/chat/completions";
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: HF_MODEL,
            messages: [{ role: "user", content: promptText }],
            max_tokens: 300
        })
    });

    const rawText = await response.text();
    if (!response.ok) {
        throw new Error(`Hugging Face API Error (${response.status}): ${rawText}`);
    }

    const data = JSON.parse(rawText);
    let content = data.choices?.[0]?.message?.content?.trim() || "";
    if (!content) {
        throw new Error("Empty response from Hugging Face API.");
    }
    return content.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").replace(/^["']\vert{}["']$/g, "").trim();
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-goog-api-key");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method === "GET") {
        return res.status(200).json({
            status: "ok",
            message: "AI Nudge Handler Ready",
            models: { gemini: GEMINI_MODEL, hugging_face: HF_MODEL }
        });
    }

    if (req.method === "POST") {
        try {
            const {
                provider = "gemini",
                apiKey = "",
                product = "",
                productInfo = {},
                userPreference = ""
            } = req.body || {};

            if (!product) {
                return res.status(400).json({ error: "Please select a product first." });
            }
            if (!userPreference || !userPreference.trim()) {
                return res.status(400).json({ error: "Please enter a natural language user preference." });
            }

            const promptText = buildNudgePrompt(product, productInfo, userPreference.trim());
            const cleanUserKey = apiKey.trim();
            let nudge = "";

            if (provider === "hugging_face") {
                const activeHfKey = cleanUserKey || DEFAULT_HF_KEY;
                nudge = await callHuggingFace(promptText, activeHfKey);
            } else {
                const activeGeminiKey = cleanUserKey || DEFAULT_GEMINI_KEY;
                nudge = await callGemini(promptText, activeGeminiKey);
            }

            return res.status(200).json({
                nudge: nudge,
                product: product,
                provider: provider,
                source: cleanUserKey ? "BYOK_User_Key" : "Server_Default_Key"
            });
        } catch (err) {
            console.error("[AI Nudge Call Failed]:", err.message);
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
};