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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  console.log(`🚗 Vehicles handler - Método recibido: ${req.method}`);

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

    const db = getDb();

    // GET: Obtener vehículos del usuario
    if (req.method === "GET") {
      // Obtener user_id del usuario desde la colección users
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      const user_id = userData?.user_id;

      if (!user_id) {
        return res.status(400).json({ error: "User ID not found" });
      }

      // Obtener documento del driver
      const driverDoc = await db.collection("drivers").doc(user_id).get();
      
      if (!driverDoc.exists) {
        return res.status(200).json({ vehicles: [] });
      }

      const driverData = driverDoc.data();
      const vehicles = driverData?.vehicles || [];

      return res.status(200).json({ vehicles });
    }

    // POST: Registrar nuevo vehículo
    if (req.method === "POST") {
      const { license_plate, model, capacity, SOAT, photo } = req.body || {};

      // Validaciones
      if (!license_plate?.trim()) {
        return res.status(400).json({ error: "license_plate is required" });
      }

      // Validar formato de placa colombiana: 3 letras mayúsculas + 3 números
      const plate = license_plate.trim().toUpperCase();
      const colombianPlateRegex = /^[A-Z]{3}[0-9]{3}$/;
      if (!colombianPlateRegex.test(plate)) {
        return res.status(400).json({ 
          error: "El formato de la placa debe ser: 3 letras mayúsculas + 3 números (ej: ABC123)" 
        });
      }
      if (!model?.trim()) {
        return res.status(400).json({ error: "model is required" });
      }
      if (!capacity || capacity < 1) {
        return res.status(400).json({ error: "capacity must be at least 1" });
      }
      if (!SOAT || (typeof SOAT === "string" && !SOAT.trim())) {
        return res.status(400).json({ error: "SOAT is required" });
      }

      // Obtener user_id del usuario desde la colección users
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      const user_id = userData?.user_id;

      if (!user_id) {
        return res.status(400).json({ error: "User ID not found" });
      }

      // Generar ID único para el vehículo
      const vehicle_id = db.collection("_temp").doc().id;

      const newVehicle = {
        vehicle_id,
        user_id,
        license_plate: plate, // Ya está en mayúsculas y validado
        model: model.trim(),
        capacity: parseInt(capacity),
        SOAT: SOAT || null,
        photo: photo || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Obtener o crear documento del driver
      const driverRef = db.collection("drivers").doc(user_id);
      const driverDoc = await driverRef.get();

      if (driverDoc.exists) {
        // Actualizar: agregar vehículo al array
        const driverData = driverDoc.data();
        const vehicles = driverData?.vehicles || [];
        vehicles.push(newVehicle);
        
        await driverRef.update({
          vehicles,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Crear nuevo documento con el vehículo
        await driverRef.set({
          user_id,
          vehicles: [newVehicle],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        message: "Registered vehicle",
        vehicle_id,
      });
    }

    // DELETE: Eliminar vehículo
    if (req.method === "DELETE") {
      console.log("🗑️ DELETE request recibido");
      console.log("Body recibido:", req.body);
      console.log("Query recibido:", req.query);
      
      // Admite path param (req.query.id) o body (req.body.vehicle_id)
      const vehicle_id = (req.query?.id as string) || req.body?.vehicle_id;

      if (!vehicle_id || typeof vehicle_id !== "string") {
        console.error("❌ vehicle_id faltante o inválido:", vehicle_id);
        return res.status(400).json({ error: "Vehicle id is required" });
      }

      // Obtener user_id del usuario desde la colección users
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      const user_id = userData?.user_id;

      if (!user_id) {
        return res.status(400).json({ error: "User ID not found" });
      }

      // Obtener documento del driver
      const driverRef = db.collection("drivers").doc(user_id);
      const driverDoc = await driverRef.get();

      if (!driverDoc.exists) {
        return res.status(404).json({ error: "Driver not found" });
      }

      const driverData = driverDoc.data();
      const vehicles = driverData?.vehicles || [];

      // Verificar que el vehículo existe y pertenece al usuario
      const vehicleIndex = vehicles.findIndex(
        (v: any) => v.vehicle_id === vehicle_id
      );

      if (vehicleIndex === -1) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      // Verificar que hay más de 1 vehículo antes de eliminar (debe quedar al menos 1)
      if (vehicles.length <= 1) {
        return res.status(400).json({ 
          error: "No se puede eliminar. Debes tener al menos 1 vehículo registrado." 
        });
      }

      // Eliminar el vehículo del array
      vehicles.splice(vehicleIndex, 1);

      // Actualizar el documento del driver
      await driverRef.update({
        vehicles,
        updatedAt: new Date().toISOString(),
      });

      return res.status(200).json({
        message: "Vehicle deleted successfully",
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Error in vehicles handler:", error);
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

