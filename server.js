import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/**
 * 1. Ürün kodundan UUID bul
 */
async function getProductUUID(productCode) {
  const resp = await fetch(
    `https://public.trendyol.com/discovery-web-searchgw-service/v2/api/infinite-scroll/sr?q=${productCode}`
  );
  const data = await resp.json();

  // İlk ürünü alıyoruz
  const product = data?.result?.products?.[0];
  if (!product) return null;

  return product.id; // Bu bizim UUID
}

/**
 * 2. UUID ile yorumları çek
 */
async function getProductReviews(uuid) {
  const resp = await fetch(
    "https://public.trendyol.com/discovery-web-websfx-reviewsgraphql",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query listCustomerReviews($productId: String!, $page: Int, $limit: Int) {
            listCustomerReviews(
              productId: $productId,
              pagination: { page: $page, limit: $limit },
              sortWithImagesFirst: true
            ) {
              count
              data {
                comment
                star
              }
            }
          }
        `,
        variables: { productId: uuid, page: 1, limit: 20 },
      }),
    }
  );

  const gqlData = await resp.json();
  return (
    gqlData?.data?.listCustomerReviews?.data?.map((r) => r.comment).filter(Boolean) || []
  );
}

/**
 * 3. ChatGPT ile özetle
 */
async function summarizeComments(comments) {
  const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Sen bir e-ticaret yorum özeti yapıcısısın. Yorumları kısa, anlaşılır bir özet halinde döndür.",
        },
        { role: "user", content: comments.join("\n\n") },
      ],
      max_tokens: 200,
    }),
  });

  const aiData = await aiResp.json();
  return aiData?.choices?.[0]?.message?.content || "Özet alınamadı.";
}

/**
 * 4. API endpoint
 */
app.post("/summarize", async (req, res) => {
  try {
    const { productCode } = req.body;
    if (!productCode) {
      return res.status(400).json({ error: "productCode gerekli" });
    }

    // Ürün UUID bul
    const uuid = await getProductUUID(productCode);
    if (!uuid) {
      return res.json({ summary: "Ürün bulunamadı.", count: 0 });
    }

    // Yorumları al
    const comments = await getProductReviews(uuid);
    if (!comments || comments.length === 0) {
      return res.json({ summary: "Henüz yorum yok.", count: 0 });
    }

    // Özet al
    const summary = await summarizeComments(comments);

    res.json({ summary, count: comments.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Backend ${PORT} portunda çalışıyor`)
);
