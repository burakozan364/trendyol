import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/summarize", async (req, res) => {
  const { productId } = req.body;
  console.log("🟢 İstek geldi, productId:", productId);

  try {
    // ✅ Yorumları senin Ikas API'nden çekiyoruz
    const gqlResponse = await fetch("https://api.myikas.com/api/sf/graphql?op=listCustomerReviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query listCustomerReviews($productId: String!, $page: Int, $limit: Int) {
            listCustomerReviews(
              productId: $productId,
              pagination: { page: $page, limit: $limit }
            ) {
              count
              data {
                comment
              }
            }
          }
        `,
        variables: { productId, page: 1, limit: 10 }
      })
    });

    const gqlData = await gqlResponse.json();
    console.log("🟠 myikas cevabı:", JSON.stringify(gqlData, null, 2));

    const comments = gqlData.data?.listCustomerReviews?.data?.map(r => r.comment).filter(Boolean) || [];
    console.log("🟡 Toplanan yorum sayısı:", comments.length);

    if (comments.length === 0) {
      return res.json({ summary: "Henüz yorum yok.", count: 0 });
    }

    // ✅ OpenAI'ya gönderiyoruz
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Sen bir e-ticaret yorum özeti yapıcısısın. Yorumları kısa, anlaşılır bir özet halinde döndür." },
          { role: "user", content: comments.join("\n\n") }
        ],
        max_tokens: 200
      })
    });

    const aiData = await aiResponse.json();
    console.log("🔵 OpenAI cevabı:", JSON.stringify(aiData, null, 2));

    const summary = aiData.choices?.[0]?.message?.content || "Özet alınamadı.";
    res.json({ summary, count: comments.length });

  } catch (err) {
    console.error("🔴 Backend Hatası:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend ${PORT} portunda çalışıyor`));
