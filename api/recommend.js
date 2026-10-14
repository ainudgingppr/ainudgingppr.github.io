const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const MODEL_NAME = "gemini-3.5-flash";

async function getAiRecommendationsFromGemini(products, preferences) {
    if (!GEMINI_API_KEY) {
        throw new Error("Missing GEMINI_API_KEY in environment variables.");
    }

    const simplifiedProducts = Array.isArray(products)
        ? products.map(p => (typeof p === 'string' ? p : (p.name || String(p))))
        : [];

    const promptText = `
Understand the following two user-uploaded data:
1. User Preferences ${JSON.stringify(preferences)}
2. Database consisting of available products with descriptions: ${JSON.stringify(simplifiedProducts)}

Task:
Based on the user preferences, choose up to 3 products from the database and recommend the user with detailed reasoning.

Rules:
1. For the recommendation message, output PLAIN TEXT only. No markdown, no quotes, no explanation.
2. Engineer the nudge message to demonstrate emphasis on user preference.
3. The nudge message should show care, understanding instead of relying on cold messages like "referring to your preference / according to your instruction / etc".
`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: promptText }
                ]
            }
        ]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
    });

    clearTimeout(timeoutId);

    const rawResponseText = await response.text();

    if (!response.ok) {
        throw new Error(`Google Gemini API Error (${response.status}): ${rawResponseText}`);
    }

    let data;
    try {
        data = JSON.parse(rawResponseText);
    } catch (e) {
        throw new Error(`Failed to parse Gemini response: ${rawResponseText}`);
    }

    let content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!content) {
        throw new Error(`Empty text returned from Gemini API: ${rawResponseText}`);
    }

    // 清理 markdown 語法與多餘引號
    content = content.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
    content = content.replace(/^["']|["']$/g, '');

    return content;
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
            message: "Gemini Handler Ready",
            has_key: Boolean(GEMINI_API_KEY),
            key_preview: GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 6)}...${GEMINI_API_KEY.slice(-4)}` : "None",
            key_length: GEMINI_API_KEY.length,
            model: MODEL_NAME
        });
    }

    if (req.method === "POST") {
        try {
            const { products = [], preferences = {} } = req.body || {};

            if (!products || products.length < 3) {
                return res.status(400).json({ error: "Products list must contain at least 3 items." });
            }

            const recommendation = await getAiRecommendationsFromGemini(products, preferences);

            return res.status(200).json({
                recommendation: recommendation,
                source: "Gemini_API_Live"
            });

        } catch (err) {
            console.error("[Backend Gemini Call Failed]:", err.message);
            return res.status(500).json({
                error: err.message,
                source: "Fallback_Due_To_Error"
            });
        }
    }

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
};
