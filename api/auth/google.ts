import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth } from "../../src/firebase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.CORS_ORIGIN || "*";
  
  // Permitir múltiples orígenes (separados por coma) o localhost para desarrollo
  let corsOrigin = "*";
  if (allowedOrigin !== "*") {
    const allowedOrigins = allowedOrigin.split(",").map(o => o.trim());
    if (origin && allowedOrigins.includes(origin)) {
      corsOrigin = origin;
    } else if (origin && (origin.includes("localhost") || origin.includes("127.0.0.1"))) {
      corsOrigin = origin;
    } else if (allowedOrigins.length === 1 && allowedOrigins[0]) {
      corsOrigin = allowedOrigins[0];
    }
  } else if (origin) {
    corsOrigin = origin;
  }
  
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Google ID token required" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({ error: "Invalid authorization token" });
    }

    // Verificar el token de Google con Firebase Admin
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);

    // El usuario ya fue creado en Firebase Auth por el frontend
    // Solo verificamos que el token es válido
    // El sign_in_provider puede estar en firebase.sign_in_provider o en otros campos
    const signInProvider = decodedToken.firebase?.sign_in_provider || 
                          (decodedToken.iss?.includes("google") ? "google.com" : null);

    return res.status(200).json({
      idToken: idToken,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified || false,
        name: decodedToken.name || null,
        picture: decodedToken.picture || null,
      },
    });
  } catch (error: any) {
    console.error("Error in google auth handler:", error);
    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({ error: "Token expired" });
    }
    if (error.code === "auth/argument-error") {
      return res.status(401).json({ error: "Invalid token" });
    }
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message || "Unknown error"
    });
  }
}

