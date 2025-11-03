cat > api/items.ts <<'EOF'
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../src/firebase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const col = db.collection("items");

  if (req.method === "GET") {
    const snap = await col.orderBy("createdAt", "desc").limit(50).get();
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    return res.status(200).json({ items });
  }

  if (req.method === "POST") {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") return res.status(400).json({ error: "text required" });
    const doc = await col.add({ text, createdAt: new Date().toISOString() });
    return res.status(201).json({ id: doc.id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
EOF
