import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, getAuth } from "../src/firebase";
import { computeCorsOrigin } from "../src/utils/cors";

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const content = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(content), Math.sqrt(1 - content));
  return R * c;
}

function distancePointToSegmentKm(point: { lat: number; lng: number }, start: { lat: number; lng: number }, end: { lat: number; lng: number }): number {
  // Equirectangular approximation for small distances
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;

  const lat1 = toRad(start.lat);
  const lat2 = toRad(end.lat);
  const lon1 = toRad(start.lng);
  const lon2 = toRad(end.lng);
  const latP = toRad(point.lat);
  const lonP = toRad(point.lng);

  const x1 = R * lon1 * Math.cos((lat1 + lat2) / 2);
  const y1 = R * lat1;
  const x2 = R * lon2 * Math.cos((lat1 + lat2) / 2);
  const y2 = R * lat2;
  const xP = R * lonP * Math.cos((lat1 + lat2) / 2);
  const yP = R * latP;

  const dx = x2 - x1;
  const dy = y2 - y1;

  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.sqrt((xP - x1) * (xP - x1) + (yP - y1) * (yP - y1));
  }

  let t = ((xP - x1) * dx + (yP - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.sqrt((xP - projX) * (xP - projX) + (yP - projY) * (yP - projY));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.CORS_ORIGIN || "*";
  const corsOrigin = computeCorsOrigin(origin, allowedOrigin);

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
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

    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const db = getDb();
 
     if (req.method === "GET") {
      const searchFlag = String((req.query as any).search || "") === "true";
 
       if (searchFlag) {
         const fromLat = toNumber(firstValue(req.query.fromLat as any));
         const fromLng = toNumber(firstValue(req.query.fromLng as any));
         const toLat = toNumber(firstValue(req.query.toLat as any));
         const toLng = toNumber(firstValue(req.query.toLng as any));
         const requestedDate = firstValue(req.query.date as any);
         const requestedTime = firstValue(req.query.time as any);
 
         if (
           fromLat === null ||
           fromLng === null ||
           toLat === null ||
           toLng === null
         ) {
           return res.status(400).json({ error: "fromLat, fromLng, toLat and toLng are required for search" });
         }

         const passengerFrom = { lat: fromLat, lng: fromLng };
         const passengerTo = { lat: toLat, lng: toLng };
         const passengerDateTimeMs = requestedDate
           ? new Date(`${requestedDate}T${requestedTime || "00:00"}:00`).getTime()
           : null;
 
         const snapshot = await db
           .collection("trips")
           .where("status", "==", "open")
           .limit(50)
           .get();
 
        const averageSpeedKmPerMin = 30 / 60; // 0.5 km/min (30 km/h)
        const baseRouteToleranceKm = 0.5; // ~500 m para tolerar errores de coordenadas
        const fixedExtraMarginKm = 0.2; // margen adicional fijo
 
        const trips: any[] = [];

        snapshot.forEach((doc) => {
          const trip = doc.data() as any;

          if (trip.driver_uid === uid) {
            return;
          }

          const tripDateIso = trip.time ? new Date(trip.time).toISOString().slice(0, 10) : null;
          if (requestedDate && tripDateIso !== requestedDate) {
            return;
          }

          const tripTimeMs = trip.time ? new Date(trip.time).getTime() : null;
          if (passengerDateTimeMs && tripTimeMs) {
            const timeDifference = Math.abs(tripTimeMs - passengerDateTimeMs) / 60000;
            const timeAllowance = Number(trip.extra_minutes || 0) + 30; // base allowance + margin
            if (timeDifference > timeAllowance) {
              return;
            }
          }

          const startCoord = trip.start?.coordinates;
          const destCoord = trip.destination?.coordinates;

          if (
            !startCoord ||
            !destCoord ||
            typeof startCoord.lat !== "number" ||
            typeof startCoord.lng !== "number" ||
            typeof destCoord.lat !== "number" ||
            typeof destCoord.lng !== "number"
          ) {
            return;
          }

          const driverRouteKm = haversineDistanceKm(startCoord, destCoord);
          const detourRouteKm =
            haversineDistanceKm(startCoord, passengerFrom) +
            haversineDistanceKm(passengerFrom, passengerTo) +
            haversineDistanceKm(passengerTo, destCoord);

          const extraDistanceKm = Math.max(detourRouteKm - driverRouteKm, 0);
          const extraMinutesAvailable = Number(trip.extra_minutes || 0);
          const detourAllowanceKm = extraMinutesAvailable * averageSpeedKmPerMin + fixedExtraMarginKm;

          const estimatedMinutes = extraDistanceKm / averageSpeedKmPerMin;

          const distanceToOriginKm = haversineDistanceKm(startCoord, passengerFrom);
          const distanceToDestinationKm = haversineDistanceKm(destCoord, passengerTo);

          const routeDistanceToOrigin = distancePointToSegmentKm(passengerFrom, startCoord, destCoord);
          const routeDistanceToDestination = distancePointToSegmentKm(passengerTo, startCoord, destCoord);

          const originWithinAllowance =
            routeDistanceToOrigin <= baseRouteToleranceKm &&
            distanceToOriginKm <= detourAllowanceKm + baseRouteToleranceKm;

          const destinationWithinAllowance =
            routeDistanceToDestination <= baseRouteToleranceKm &&
            distanceToDestinationKm <= detourAllowanceKm + baseRouteToleranceKm;

          const detourWithinAllowance = extraDistanceKm <= detourAllowanceKm;

          const extraMinutesRequired = estimatedMinutes;
          const minutesAllowance = extraMinutesAvailable + 15; // 15 min margen adicional

          console.log("[Trips search]", {
            trip_id: doc.id,
            originWithinAllowance,
            destinationWithinAllowance,
            detourWithinAllowance,
            extraMinutesRequired: Number(extraMinutesRequired.toFixed(2)),
            minutesAllowance,
            distanceToOriginKm: Number(distanceToOriginKm.toFixed(2)),
            distanceToDestinationKm: Number(distanceToDestinationKm.toFixed(2)),
            routeDistanceToOrigin,
            routeDistanceToDestination,
            detourAllowanceKm,
          });

          if (
            originWithinAllowance &&
            destinationWithinAllowance &&
            detourWithinAllowance &&
            extraMinutesRequired <= minutesAllowance
          ) {
            trips.push({
              trip_id: doc.id,
              ...trip,
              estimated_minutes_detour: Number(estimatedMinutes.toFixed(1)),
              extra_distance_km: Number(extraDistanceKm.toFixed(2)),
            });
          }
        });

        const sortedTrips = trips.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        return res.status(200).json({ trips: sortedTrips });
      }

      const snapshot = await db
        .collection("trips")
        .where("driver_uid", "==", uid)
        .limit(50)
        .get();

      const trips = snapshot.docs
        .map((doc) => ({ trip_id: doc.id, ...(doc.data() as any) }))
        .sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

      return res.status(200).json({ trips });
    }

    if (req.method === "POST") {
      const {
         driver_id,
         start,
         destination,
         time,
         seats,
         fare,
         extra_minutes,
       } = req.body || {};

      if (!start?.address) {
        return res.status(400).json({ error: "start.address is required" });
      }

      if (!destination?.address) {
        return res.status(400).json({ error: "destination.address is required" });
      }

      if (!time) {
        return res.status(400).json({ error: "time is required" });
      }

      const seatsNumber = Number(seats);
      if (!Number.isFinite(seatsNumber) || seatsNumber <= 0) {
        return res.status(400).json({ error: "seats must be a positive number" });
      }

      const fareNumber = Number(fare);
      if (!Number.isFinite(fareNumber) || fareNumber <= 0) {
        return res.status(400).json({ error: "fare must be a positive number" });
      }

      const extraMinutesNumber = extra_minutes ? Number(extra_minutes) : 0;
      if (extra_minutes !== undefined && (!Number.isFinite(extraMinutesNumber) || extraMinutesNumber < 0)) {
        return res.status(400).json({ error: "extra_minutes must be zero or a positive number" });
      }

      const sanitizedTrip: any = {
        driver_id: driver_id || uid,
        driver_uid: uid,
        driver_email: decodedToken.email || null,
        start: {
          address: String(start.address),
          coordinates: start.coordinates && typeof start.coordinates === "object"
            ? {
                lat: Number((start.coordinates as any).lat) || null,
                lng: Number((start.coordinates as any).lng) || null,
              }
            : null,
        },
        destination: {
          address: String(destination.address),
          coordinates: destination.coordinates && typeof destination.coordinates === "object"
            ? {
                lat: Number((destination.coordinates as any).lat) || null,
                lng: Number((destination.coordinates as any).lng) || null,
              }
            : null,
        },
        time: String(time),
        seats: seatsNumber,
        fare: fareNumber,
        extra_minutes: extraMinutesNumber,
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (req.body?.driver) {
        sanitizedTrip.driver = {
          uid: req.body.driver.uid || uid,
          name: req.body.driver.name || null,
          email: req.body.driver.email || decodedToken.email || null,
          photo: req.body.driver.photo || null,
        };
      }

      if (req.body?.vehicle) {
        sanitizedTrip.vehicle = {
          vehicle_id: req.body.vehicle.vehicle_id || null,
          license_plate: req.body.vehicle.license_plate || null,
          model: req.body.vehicle.model || null,
          capacity: toNumber(req.body.vehicle.capacity) || null,
        };
      }
 
      const docRef = await db.collection("trips").add(sanitizedTrip);
      return res.status(201).json({ message: "Posted trip", trip_id: docRef.id });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Error in trips handler:", error);
    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({ error: "Token expired" });
    }
    if (error.code === "auth/argument-error") {
      return res.status(401).json({ error: "Invalid token" });
    }

    return res.status(500).json({
      error: "Internal server error",
      message: error.message || "Unknown error",
    });
  }
}
