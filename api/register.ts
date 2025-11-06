import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, getAuth } from "../src/firebase";

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
      return res.status(401).json({ error: "Authorization token required" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({ error: "Invalid authorization token" });
    }

    // Verificar el token
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Obtener datos del body
    const { first_name, last_name, user_id, email, phone, user_photo, city, address, nearby_landmark } = req.body || {};

    // Validaciones (solo campos requeridos para creación inicial)
    // Para actualización, estos campos pueden ser opcionales
    const isUpdate = req.body?.isUpdate === true;
    
    if (!isUpdate) {
      // Validaciones solo para registro nuevo
      if (!first_name?.trim()) {
        return res.status(400).json({ error: "first_name is required" });
      }
      if (!last_name?.trim()) {
        return res.status(400).json({ error: "last_name is required" });
      }
      if (!user_id?.trim()) {
        return res.status(400).json({ error: "user_id is required" });
      }
      if (!email?.trim()) {
        return res.status(400).json({ error: "email is required" });
      }
      if (!phone?.trim()) {
        return res.status(400).json({ error: "phone is required" });
      }
    }

    // Guardar o actualizar usuario en Firestore
    const db = getDb();
    const userData: any = {
      uid,
      updatedAt: new Date().toISOString(),
    };

    // Agregar campos solo si están presentes (incluso si están vacíos para actualización)
    if (first_name !== undefined) userData.first_name = first_name?.trim() || "";
    if (last_name !== undefined) userData.last_name = last_name?.trim() || "";
    if (user_id !== undefined) userData.user_id = user_id?.trim() || "";
    if (email !== undefined) userData.email = email?.trim() || "";
    if (phone !== undefined) userData.phone = phone?.trim() || "";
    if (user_photo !== undefined) userData.user_photo = user_photo || null;
    // Para city, address y nearby_landmark, permitir valores vacíos
    if (city !== undefined) userData.city = city?.trim() || "";
    if (address !== undefined) userData.address = address?.trim() || "";
    if (nearby_landmark !== undefined) userData.nearby_landmark = nearby_landmark?.trim() || "";
    
    console.log("Datos recibidos para actualizar:", {
      city,
      address,
      nearby_landmark,
      first_name,
      last_name,
      phone,
    });
    console.log("Datos a guardar en Firestore:", userData);

    // Verificar si el usuario ya existe
    const userDoc = await db.collection("users").doc(uid).get();
    
    if (userDoc.exists) {
      // Actualizar usuario existente (preservar createdAt)
      const existingData = userDoc.data();
      const updateData: any = {
        ...userData,
        updatedAt: new Date().toISOString(),
        createdAt: existingData?.createdAt || new Date().toISOString(),
      };
      
      console.log("Actualizando usuario en Firestore:", updateData);
      await db.collection("users").doc(uid).update(updateData);
      
      console.log("Usuario actualizado exitosamente");
    } else {
      // Crear nuevo usuario
      userData.createdAt = new Date().toISOString();
      console.log("Creando nuevo usuario en Firestore:", userData);
      await db.collection("users").doc(uid).set(userData);
    }

    return res.status(200).json({
      message: "Registration successful",
      user_id: user_id?.trim() || uid,
      updated: userDoc.exists,
    });
  } catch (error: any) {
    console.error("Error in register handler:", error);
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

