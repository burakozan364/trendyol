import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/summarize", async (req, res) => {
  const { productId } = req.body;

  try {
    // 1️⃣ Senin yorum API'nden verileri çekelim
    const apiResp = await fetch(`https://elitcikolata.com.tr/api/comments?productId=${productId}`);
    const apiData = await apiResp.json();

    // 2️⃣ Yorumları al (comment alanı varsa)
    const comments = apiData.map(r => r.comment).filter(Boolean);

    if (comments.length === 0) {
      return res.json({ summary: "Henüz yorum yok.", count: 0 });
    }

    // 3️⃣ OpenAI API ile özetleme
    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Sen bir e-ticaret yorum özeti yapıcısısın. Yorumları kısa, anlaşılır bir özet halinde döndür." },
          { role: "user", content: comments.join("\n\n") }
        ],
        max_tokens: 200,
      }),
    });

    const aiData = await aiResp.json();
    const summary = aiData?.choices?.[0]?.message?.content || "Özet alınamadı.";

    // 4️⃣ Frontend'e dön
    res.json({ summary, count: comments.length });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend ${PORT} portunda çalışıyor`));
