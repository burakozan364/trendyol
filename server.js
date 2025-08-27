import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Tüm sayfalardan yorumları GraphQL API ile çekiyoruz
async function fetchAllReviews(productId) {
  let page = 1;
  let allComments = [];
  let hasNext = true;

  while (hasNext) {
    const res = await fetch("https://www.elitcikolata.com.tr/graphql?op=listCustomerReviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Eğer login gerekiyorsa buraya Authorization header koyman lazım
      },
      body: JSON.stringify({
        query: `
          query listCustomerReviews($pagination: PaginationInput, $productId: String!) {
            listCustomerReviews(pagination: $pagination, productId: $productId) {
              count
              hasNext
              data {
                comment
              }
            }
          }
        `,
        variables: {
          productId,
          pagination: { page, limit: 5 },
        }
      })
    });

    const json = await res.json();
    const reviews = json?.data?.listCustomerReviews?.data || [];
    hasNext = json?.data?.listCustomerReviews?.hasNext || false;

    allComments.push(...reviews.map(r => r.comment));
    page++;
  }

  return allComments;
}

// 🔹 Özetleme endpoint
app.post("/summarize", async (req, res) => {
  const { productId } = req.body;

  try {
    const comments = await fetchAllReviews(productId);

    if (!comments.length) {
      return res.json({ summary: "Henüz yorum bulunamadı.", count: 0 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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

    const data = await response.json();
    res.json({
      count: comments.length,
      summary: data.choices[0].message.content
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend ${PORT} portunda çalışıyor`));
