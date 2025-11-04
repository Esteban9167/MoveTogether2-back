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
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Firebase Admin SDK no tiene createUserWithEmailAndPassword directamente
    // Necesitamos usar Firebase Auth REST API
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Firebase Web API key not configured" });
    }

    // Usar Firebase Auth REST API para crear usuario
    const firebaseAuthUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
    
    const response = await fetch(firebaseAuthUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password: password,
        returnSecureToken: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.error?.message === "EMAIL_EXISTS") {
        return res.status(400).json({ error: "El correo ya está registrado" });
      }
      if (data.error?.message === "INVALID_EMAIL") {
        return res.status(400).json({ error: "Correo electrónico inválido" });
      }
      if (data.error?.message === "WEAK_PASSWORD") {
        return res.status(400).json({ error: "La contraseña es muy débil" });
      }
      return res.status(400).json({ 
        error: data.error?.message || "Error al crear la cuenta" 
      });
    }

    // Verificar el token con Firebase Admin
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(data.idToken);

    return res.status(201).json({
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
      },
    });
  } catch (error: any) {
    console.error("Error in register handler:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message || "Unknown error"
    });
  }
}

