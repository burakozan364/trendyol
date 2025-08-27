import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Yorumları myikas API'den çek
async function fetchComments(productId) {
  const response = await fetch("https://api.myikas.com/api/sf/graphql?op=listCustomerReviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        query listCustomerReviews($productId: String!, $pagination: PaginationInput) {
          listCustomerReviews(productId: $productId, pagination: $pagination) {
            data {
              comment
            }
            hasNext
          }
        }
      `,
      variables: {
        productId, 
        pagination: { page: 1, limit: 50 }
      }
    })
  });

  const json = await response.json();
  return json?.data?.listCustomerReviews?.data?.map(r => r.comment).filter(Boolean) || [];
}

// GPT ile özetle
async function summarizeComments(comments) {
  if (!comments.length) return "Henüz yorum bulunamadı.";

  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Sen bir e-ticaret yorum özetleyicisisin. Yorumları kısaca toparla." },
        { role: "user", content: comments.join("\n\n") }
      ],
      max_tokens: 200
    })
  });

  const aiData = await aiResponse.json();
  return aiData?.choices?.[0]?.message?.content || "Özet alınamadı.";
}

app.post("/summarize", async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ error: "productId gerekli" });
  }

  try {
    const comments = await fetchComments(productId);
    const summary = await summarizeComments(comments);
    res.json({ summary, count: comments.length });
  } catch (err) {
    console.error("Hata:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✨ Backend ${PORT} portunda çalışıyor`));
