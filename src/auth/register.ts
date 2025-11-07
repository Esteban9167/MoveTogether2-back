// Ruta: back/api/register.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth, getDb } from "../../src/firebase";

const allowList = (process.env.CORS_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function allowOrigin(origin = "") {
  return allowList.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || "";
  if (allowOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")  return res.status(405).json({ error: "Method not allowed" });

  try {
    // Vercel puede entregar el body como string
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    
    // Log para debuggear qué está llegando
    console.log("📥 Register handler - Body recibido:", JSON.stringify(body, null, 2));
    console.log("📥 Register handler - Body keys:", Object.keys(body));
    console.log("📥 Register handler - Authorization header:", req.headers.authorization ? "Bearer ***" : "none");
    
    const authHeader = req.headers.authorization;
    const hasToken = authHeader && authHeader.startsWith("Bearer ");
    
    // CASO 1: Si viene token de autorización y datos del usuario, guardar en Firestore
    if (hasToken && (body.first_name || body.user_id || body.phone)) {
      const idToken = authHeader!.split("Bearer ")[1];
      if (!idToken) {
        return res.status(401).json({ error: "Invalid authorization token" });
      }

      const auth = getAuth();
      const decodedToken = await auth.verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Guardar o actualizar datos del usuario en Firestore
      const db = getDb();
      const userData = {
        first_name: body.first_name || "",
        last_name: body.last_name || "",
        user_id: body.user_id || "",
        email: body.email || decodedToken.email || "",
        phone: body.phone || "",
        user_photo: body.user_photo || null,
        updated_at: new Date().toISOString(),
      };

      // Si el usuario ya existe, actualizar; si no, crear
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        await userRef.update(userData);
        console.log("✅ Usuario actualizado en Firestore:", uid);
      } else {
        await userRef.set({
          ...userData,
          created_at: new Date().toISOString(),
        });
        console.log("✅ Usuario creado en Firestore:", uid);
      }

      return res.status(200).json({
        message: "Usuario guardado correctamente",
        user: {
          uid,
          ...userData,
        },
      });
    }

    // CASO 2: Si viene email y password, crear usuario en Firebase Auth
    let { email, password } = body;

    if (!email || !password) {
      console.error("❌ Register handler - Faltan email o password. Body recibido:", body);
      return res.status(400).json({ error: "Email and password are required" });
    }
    email = String(email).trim().toLowerCase();
    password = String(password);

    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Firebase Web API key not configured" });

    // Alta en Firebase Auth vía REST (mismo proyecto que Admin SDK)
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const code = data?.error?.message;
      if (code === "EMAIL_EXISTS")   return res.status(409).json({ error: "El correo ya está registrado" });
      if (code === "INVALID_EMAIL")  return res.status(400).json({ error: "Correo electrónico inválido" });
      if (code === "WEAK_PASSWORD")  return res.status(400).json({ error: "La contraseña es muy débil" });
      return res.status(400).json({ error: code || "Error al crear la cuenta" });
    }

    // Verificación del ID token con Admin SDK
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(data.idToken);

    // Opcional: session cookie en vez de exponer idToken al cliente
    // const sessionCookie = await auth.createSessionCookie(data.idToken, { expiresIn: 5 * 24 * 60 * 60 * 1000 });
    // res.setHeader("Set-Cookie", `session=${sessionCookie}; HttpOnly; Secure; SameSite=None; Path=/`);

    return res.status(201).json({
      idToken: data.idToken,            // quita esto si usas cookie de sesión
      refreshToken: data.refreshToken,  // idem
      user: {
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: decoded.email_verified,
      },
    });
  } catch (e: any) {
    console.error("Error in register handler:", e?.message, e);
    return res.status(500).json({ error: "Internal server error", message: e?.message || "Unknown error" });
  }
}
