import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// CORS ayarı
app.use(cors({
  origin: "*", // gerekirse sadece kendi domainini yazabilirsin
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Özetleme endpoint
app.post("/summarize", async (req, res) => {
  const { comments } = req.body;

  if (!comments || comments.length === 0) {
    return res.status(400).json({ error: "Yorum verisi yok" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "bir e-ticaret sitesinde satılan ürünlere yapılan yorumların özetini çıkarıyoruz. Bu yorumları özetle. Olumlu ve olumsuz yorumlar olarak 2'ye ayır. 200 kelimeyi geçme. "
          },
          { role: "user", content: comments.join("\n\n") }
        ],
        max_tokens: 200
      })
    });

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      return res.status(500).json({ error: "OpenAI'den cevap alınamadı", raw: data });
    }

    res.json({
      summary: data.choices[0].message.content
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Render port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend ${PORT} portunda çalışıyor`));

