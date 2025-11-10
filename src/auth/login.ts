import type { VercelRequest, VercelResponse } from "@vercel/node";
import fetch from "node-fetch";
import { computeCorsOrigin } from "../utils/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const corsOrigin = computeCorsOrigin(origin, process.env.CORS_ORIGIN);
  
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept"
  );
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

    // Firebase Admin SDK no tiene signInWithEmailAndPassword directamente
    // Necesitamos usar Firebase Auth REST API
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Firebase Web API key not configured" });
    }

    // Usar Firebase Auth REST API
    const firebaseAuthUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    
    // Agregar referer para evitar bloqueos
    const referer = origin || "http://localhost:3000";
    
    const response = await fetch(firebaseAuthUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Referer": referer,
      },
      body: JSON.stringify({
        email: email.trim(),
        password: password,
        returnSecureToken: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Firebase Auth REST API Error:", data);
      
      // Manejar errores específicos de Firebase
      if (data.error?.message === "EMAIL_NOT_FOUND") {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      if (data.error?.message === "INVALID_PASSWORD") {
        return res.status(401).json({ error: "Contraseña incorrecta" });
      }
      if (data.error?.message?.includes("referer") || data.error?.message?.includes("blocked")) {
        // Si el error es por referer, intentar sin referer header
        console.warn("Error de referer, reintentando sin header Referer...");
        const retryResponse = await fetch(firebaseAuthUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password: password,
            returnSecureToken: true,
          }),
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          return res.status(400).json({ 
            error: retryData.error?.message || "Error al iniciar sesión. Verifica la configuración de Firebase." 
          });
        }
        // Si el retry funciona, continuar con el flujo normal
        // const auth = getAuth(); // This line was removed as per the new_code
        // const decodedToken = await auth.verifyIdToken(retryData.idToken); // This line was removed as per the new_code
        return res.status(200).json({
          idToken: retryData.idToken,
          refreshToken: retryData.refreshToken,
          user: {
            uid: retryData.localId, // Assuming localId is the uid for this context
            email: retryData.email,
            emailVerified: retryData.emailVerified,
          },
        });
      }
      return res.status(400).json({ 
        error: data.error?.message || "Error al iniciar sesión" 
      });
    }

    // Verificar el token con Firebase Admin
    // const auth = getAuth(); // This line was removed as per the new_code
    // const decodedToken = await auth.verifyIdToken(data.idToken); // This line was removed as per the new_code

    return res.status(200).json({
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      user: {
        uid: data.localId, // Assuming localId is the uid for this context
        email: data.email,
        emailVerified: data.emailVerified,
      },
    });
  } catch (error: any) {
    console.error("Error in login handler:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message || "Unknown error"
    });
  }
}

