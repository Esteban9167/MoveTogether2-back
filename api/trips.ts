const DEFAULT_TIMEZONE_OFFSET_MINUTES = -300; // Bogotá (UTC-5)

function parseLocalDateTimeMs(date: string | null | undefined, time: string | null | undefined) {
  if (!date) return null;
  const timezoneMinutes = Number(process.env.TRIP_TIMEZONE_OFFSET_MINUTES ?? DEFAULT_TIMEZONE_OFFSET_MINUTES);
  const absMinutes = Math.abs(timezoneMinutes);
  const hours = Math.floor(absMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (absMinutes % 60).toString().padStart(2, "0");
  const sign = timezoneMinutes >= 0 ? "+" : "-";
  const iso = `${date}T${time || "00:00"}:00${sign}${hours}:${minutes}`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.getTime();
}
import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as admin from "firebase-admin";
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

type NotificationType = "tripApplication" | "tripCancelled" | "applicationCancelled" | "applicationSuccess";

function getRequestedSeatsFromEntry(entry: any): number {
  if (!entry) return 1;
  if (typeof entry === "object") {
    const raw =
      entry.requested_seats ??
      entry.seats_requested ??
      entry.requestedSeats ??
      entry.seatsRequested ??
      entry.cupos ??
      1;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
    return 1;
  }
  return 1;
}

function sumRequestedSeats(entries: any[]): number {
  if (!Array.isArray(entries)) return 0;
  // Cada entrada en el array representa 1 cupo
  return entries.length;
}

function calculateAvailableSeats(trip: any): number {
  const totalSeats = Number(trip?.seats || 0);
  if (totalSeats <= 0) return 0;
  
  const passengers = Array.isArray(trip?.passenger_list) ? trip.passenger_list : [];
  const waitlist = Array.isArray(trip?.waitlist) ? trip.waitlist : [];
  
  // Cada entrada en los arrays representa 1 cupo
  const occupiedSeats = passengers.length + waitlist.length;
  const available = Math.max(0, totalSeats - occupiedSeats);
  
  return available;
}

function enrichTripWithAvailableSeats(trip: any): any {
  const availableSeats = calculateAvailableSeats(trip);
  return {
    ...trip,
    available_seats: availableSeats,
  };
}

async function addTripMessage(
  db: FirebaseFirestore.Firestore,
  tripId: string,
  data: {
    type: string;
    message: string;
    payload?: Record<string, any> | null;
  }
) {
  if (!tripId) return null;
  try {
    const ref = await db
      .collection("trips")
      .doc(tripId)
      .collection("messages")
      .add({
        type: data.type,
        message: data.message,
        payload: data.payload ?? null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    return ref.id;
  } catch (error) {
    console.error(`[Trip Messages] Error creating message for trip ${tripId}`, error);
    return null;
  }
}

async function createUserNotification(
  db: FirebaseFirestore.Firestore,
  params: {
    uidDestino?: string | null;
    type: NotificationType;
    tripId?: string;
    message: string;
    payload?: Record<string, any> | null;
  }
) {
  const { uidDestino, type, tripId, message, payload } = params;
  if (!uidDestino) return null;
  try {
    const notifRef = await db
      .collection("users")
      .doc(uidDestino)
      .collection("notifications")
      .add({
        uidDestino,
        type,
        tripId: tripId ?? null,
        message,
        payload: payload ?? null,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    return notifRef.id;
  } catch (error) {
    console.error(`[Notifications] Error creating notification for ${uidDestino}`, error);
    return null;
  }
}

function getUserDisplayName(userData?: any, fallback?: string) {
  if (!userData) return fallback || "Un usuario";
  const first = userData.first_name || userData.firstName || "";
  const last = userData.last_name || userData.lastName || "";
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  if (userData.user_id) return String(userData.user_id);
  if (userData.email) return String(userData.email).split("@")[0];
  return fallback || "Un usuario";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.CORS_ORIGIN || "*";
  const corsOrigin = computeCorsOrigin(origin, allowedOrigin);

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
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
      const role = (firstValue((req.query as any).role) || "").toLowerCase();
      const allTripsFlag = String((req.query as any).all || "") === "true";

      // Permitir obtener viajes por una lista de IDs (para la vista de pasajero / my_trips)
      const idsParam = firstValue((req.query as any).ids);
      if (idsParam) {
        const ids = idsParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);

        if (!ids.length) {
          return res.status(400).json({ error: "ids query param is empty" });
        }

        const trips: any[] = [];
        for (const id of ids) {
          try {
            const doc = await db.collection("trips").doc(id).get();
            if (doc.exists) {
              trips.push({ trip_id: doc.id, ...(doc.data() as any) });
            }
          } catch (err) {
            console.error("Error fetching trip by id", id, err);
          }
        }

        const sortedTrips = trips.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        const enrichedTrips = sortedTrips.map(enrichTripWithAvailableSeats);
        return res.status(200).json({ trips: enrichedTrips });
      }

      // Modo pasajero: viajes donde el user_id del usuario está en la waitlist
      if (role === "passenger") {
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) {
          return res.status(404).json({ error: "User not found" });
        }
        const userData = userDoc.data() as any;
        const userId = userData?.user_id;
        if (!userId) {
          return res.status(400).json({ error: "User id not found for waitlist" });
        }

        const snapshot = await db
          .collection("trips")
          .where("waitlist", "array-contains", userId)
          .limit(50)
          .get();

        const trips = snapshot.docs
          .map((doc) => ({ trip_id: doc.id, ...(doc.data() as any) }))
          .sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
          });

        const enrichedTrips = trips.map(enrichTripWithAvailableSeats);
        return res.status(200).json({ trips: enrichedTrips });
      }

      if (allTripsFlag) {
        const snapshot = await db
          .collection("trips")
          .where("time", ">=", new Date().toISOString())
          .limit(200)
          .get();

        const now = Date.now();
        const trips = snapshot.docs
          .map((doc) => ({ trip_id: doc.id, ...(doc.data() as any) }))
          .filter((trip) => {
            if (!trip.time) return true;
            const tripTime = new Date(trip.time).getTime();
            if (Number.isNaN(tripTime)) return true;
            return tripTime >= now;
          })
          .sort((a, b) => {
            const timeA = new Date(a.time || a.createdAt || 0).getTime();
            const timeB = new Date(b.time || b.createdAt || 0).getTime();
            return timeA - timeB;
          });

        const enrichedTrips = trips.map(enrichTripWithAvailableSeats);
        return res.status(200).json({ trips: enrichedTrips });
      }

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
        const passengerDateTimeMs = parseLocalDateTimeMs(requestedDate, requestedTime || "00:00");

        const debugMode = String(firstValue(req.query.debug as any) || "").toLowerCase() === "true";
        const debugDetails: any[] = [];
 
         const snapshot = await db
           .collection("trips")
           .where("status", "==", "open")
           .limit(50)
           .get();
 
        const averageSpeedKmPerMin = 30 / 60; // 0.5 km/min (30 km/h)
        const baseRouteToleranceKm = 0.5; // ~500 m para tolerar errores de coordenadas
        const fixedExtraMarginKm = 0.2; // margen adicional fijo
 
        console.log("[Trips search] snapshot size", snapshot.size);

        const trips: any[] = [];

        snapshot.forEach((doc) => {
          const trip = doc.data() as any;
          const rejectionReasons: string[] = [];

          const tripDateIso = trip.time ? new Date(trip.time).toISOString().slice(0, 10) : null;
          if (requestedDate && tripDateIso !== requestedDate) {
            if (debugMode) {
              rejectionReasons.push("date_mismatch");
              debugDetails.push({ trip_id: doc.id, reason: rejectionReasons, tripDateIso, requestedDate });
            }
            return;
          }

          const tripTimeMs = trip.time ? new Date(trip.time).getTime() : null;
          if (passengerDateTimeMs && tripTimeMs) {
            const timeDifference = Math.abs(tripTimeMs - passengerDateTimeMs) / 60000;
            const timeAllowance = Number(trip.extra_minutes || 0) + 30; // base allowance + margin
            if (timeDifference > timeAllowance) {
              if (debugMode) {
                rejectionReasons.push("time_difference");
                debugDetails.push({ trip_id: doc.id, reason: rejectionReasons, timeDifference, timeAllowance });
              }
              return;
            }
          }

          const startLat = toNumber(trip.start?.coordinates?.lat);
          const startLng = toNumber(trip.start?.coordinates?.lng);
          const destLat = toNumber(trip.destination?.coordinates?.lat);
          const destLng = toNumber(trip.destination?.coordinates?.lng);

          if (
            startLat === null ||
            startLng === null ||
            destLat === null ||
            destLng === null
          ) {
            if (debugMode) {
              rejectionReasons.push("missing_coordinates");
              debugDetails.push({ trip_id: doc.id, reason: rejectionReasons });
            }
            return;
          }

          const startCoord = { lat: startLat, lng: startLng };
          const destCoord = { lat: destLat, lng: destLng };

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

          const locationMatches = originWithinAllowance || destinationWithinAllowance;

          console.log("[Trips search]", {
            trip_id: doc.id,
            originWithinAllowance,
            destinationWithinAllowance,
            locationMatches,
            detourWithinAllowance,
            extraMinutesRequired: Number(extraMinutesRequired.toFixed(2)),
            minutesAllowance,
            distanceToOriginKm: Number(distanceToOriginKm.toFixed(2)),
            distanceToDestinationKm: Number(distanceToDestinationKm.toFixed(2)),
            routeDistanceToOrigin,
            routeDistanceToDestination,
            detourAllowanceKm,
          });

          if (locationMatches && detourWithinAllowance && extraMinutesRequired <= minutesAllowance) {
            trips.push({
              trip_id: doc.id,
              ...trip,
              estimated_minutes_detour: Number(estimatedMinutes.toFixed(1)),
              extra_distance_km: Number(extraDistanceKm.toFixed(2)),
            });
          } else if (debugMode) {
            const reasons: string[] = [];
            if (!locationMatches) reasons.push("location_mismatch");
            if (!detourWithinAllowance) reasons.push("detour_exceeded");
            if (extraMinutesRequired > minutesAllowance) reasons.push("minutes_exceeded");
            debugDetails.push({
              trip_id: doc.id,
              reason: reasons,
              originWithinAllowance,
              destinationWithinAllowance,
              detourWithinAllowance,
              extraMinutesRequired,
              minutesAllowance,
              detourAllowanceKm,
              extraDistanceKm,
              distanceToOriginKm: Number(distanceToOriginKm.toFixed(2)),
              distanceToDestinationKm: Number(distanceToDestinationKm.toFixed(2)),
            });
          }
        });

        const sortedTrips = trips.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        return res.status(200).json(
          debugMode ? { trips: sortedTrips, debug: debugDetails } : { trips: sortedTrips }
        );
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

    if (req.method === "PATCH") {
      const body: any = req.body || {};
      const { trip_id, user_id, origin, destination } = body;
      const rawAction = body.action;
      const action =
        typeof rawAction === "string" ? rawAction.toLowerCase().trim() : "";
      const requestedSeatsRaw = body.requested_seats ?? body.seats_requested ?? body.requestedSeats ?? 1;
      let requestedSeats = Number(requestedSeatsRaw);
      if (!Number.isFinite(requestedSeats) || requestedSeats <= 0) {
        requestedSeats = 1;
      }
      requestedSeats = Math.floor(requestedSeats);
      console.log(`[PATCH /api/trips] requestedSeats parsed: ${requestedSeats} (raw: ${requestedSeatsRaw})`);

      console.log(`[PATCH /api/trips] Raw body:`, JSON.stringify(body));
      console.log(`[PATCH /api/trips] Raw action: "${rawAction}", Parsed action: "${action}", trip_id: ${trip_id}, user_id: ${user_id}, uid: ${uid}`);

      if (!trip_id) {
        return res.status(400).json({ error: "trip_id is required" });
      }

      const tripRef = db.collection("trips").doc(trip_id);
      const tripDoc = await tripRef.get();

      if (!tripDoc.exists) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const tripData = tripDoc.data();

      // Acción "cancel": cancelar el viaje (solo el conductor puede cancelar)
      // Esta acción no requiere user_id, solo verifica que el usuario es el conductor
      if (action === "cancel") {
        // Solo el conductor del viaje puede cancelar
        if (tripData?.driver_uid !== uid && tripData?.driver_id !== uid) {
          return res.status(403).json({ error: "Only the driver can cancel the trip" });
        }

        // Solo se puede cancelar si el viaje está abierto
        if (tripData?.status !== "open") {
          return res.status(400).json({ error: "Only open trips can be cancelled" });
        }

        // Obtener todos los pasajeros de passenger_list y waitlist para actualizar sus my_trips
        const passengers = Array.isArray((tripData as any).passenger_list) ? [...(tripData as any).passenger_list] : [];
        const waitlist = Array.isArray(tripData?.waitlist) ? [...tripData.waitlist] : [];
        const allPassengers = [...passengers, ...waitlist];

        // Actualizar el estado del viaje a "cancelled"
        await tripRef.update({
          status: "cancelled",
          updatedAt: new Date().toISOString(),
        });

        const tripTitle =
          (typeof tripData?.destination?.address === "string" && tripData.destination.address) ||
          (typeof tripData?.start?.address === "string" && tripData.start.address) ||
          "tu viaje";

        // Actualizar el estado en my_trips de todos los pasajeros a "cancelled"
        const passengerUids = new Set<string>();
        allPassengers.forEach((p: any) => {
          if (p && typeof p === "object" && p.firebase_uid) {
            passengerUids.add(p.firebase_uid);
            console.log(`[Cancel] Found passenger with firebase_uid: ${p.firebase_uid}, user_id: ${p.user_id}`);
          } else {
            console.log(`[Cancel] Passenger entry missing firebase_uid:`, p);
          }
        });

        console.log(`[Cancel] Trip ${trip_id} cancelled by driver ${uid}, updating ${passengerUids.size} passengers`);
        console.log(`[Cancel] All passengers array:`, JSON.stringify(allPassengers, null, 2));

        // Actualizar my_trips de cada pasajero
        const updatePromises = Array.from(passengerUids).map(async (passengerUid) => {
          try {
            const passengerUserRef = db.collection("users").doc(passengerUid);
            const passengerUserDoc = await passengerUserRef.get();
            
            if (passengerUserDoc.exists) {
              const passengerUserData = passengerUserDoc.data();
              const myTrips = Array.isArray(passengerUserData?.my_trips) ? [...passengerUserData.my_trips] : [];
              
              const updatedTrips = myTrips.map((item: any) => {
                if (typeof item === "string") {
                  if (item === trip_id) {
                    return {
                      trip_id: trip_id,
                      firebase_uid: passengerUid,
                      status: "cancelled",
                      cancelledAt: new Date().toISOString(),
                      cancelledBy: "driver",
                    };
                  }
                  return item;
                }
                if (item && typeof item === "object" && item.trip_id === trip_id) {
                  return {
                    ...item,
                    status: "cancelled",
                    cancelledAt: new Date().toISOString(),
                    cancelledBy: "driver",
                  };
                }
                return item;
              });

              await passengerUserRef.update({
                my_trips: updatedTrips,
                updatedAt: new Date().toISOString(),
              });
              console.log(`[Cancel] Updated my_trips for passenger ${passengerUid}, trip ${trip_id} to cancelled`);
            }
          } catch (error: any) {
            console.error(`[Cancel] Error updating passenger ${passengerUid} my_trips:`, error);
          }
        });

        await Promise.all(updatePromises);

        console.log(`[Cancel] Creating notifications for ${passengerUids.size} passengers`);
        const notificationPromises = Array.from(passengerUids).map(async (passengerUid) => {
          console.log(`[Cancel] Creating notification for passenger ${passengerUid}`);
          const result = await createUserNotification(db, {
            uidDestino: passengerUid,
            type: "tripCancelled",
            tripId: trip_id,
            message: `El viaje "${tripTitle}" fue cancelado.`,
            payload: {
              tripId: trip_id,
              cancelledBy: uid,
            },
          });
          console.log(`[Cancel] Notification created for passenger ${passengerUid}:`, result ? "success" : "failed");
          return result;
        });

        await Promise.all(notificationPromises);
        console.log(`[Cancel] All notifications created for trip ${trip_id}`);

        console.log(`[Cancel] Trip ${trip_id} cancelled by driver ${uid}`);

        return res.status(200).json({
          message: "Trip cancelled successfully",
          status: "cancelled",
        });
      }

      // Acción "remove_passenger": el conductor remueve a un pasajero específico
      console.log(`[PATCH /api/trips] Checking action "${action}" === "remove_passenger": ${action === "remove_passenger"}`);
      if (action === "remove_passenger") {
        console.log(`[Remove Passenger] Action matched! Processing remove_passenger for trip ${trip_id}, passenger user_id: ${user_id}`);
        // Solo el conductor del viaje puede remover pasajeros
        if (tripData?.driver_uid !== uid && tripData?.driver_id !== uid) {
          console.log(`[Remove Passenger] ERROR: User ${uid} is not the driver (driver_uid: ${tripData?.driver_uid}, driver_id: ${tripData?.driver_id})`);
          return res.status(403).json({ error: "Only the driver can remove passengers" });
        }

        if (!user_id) {
          return res.status(400).json({ error: "user_id is required to identify the passenger to remove" });
        }

        console.log(`[Remove Passenger] Driver ${uid} removing passenger with user_id: ${user_id} from trip ${trip_id}`);

        // Remover TODAS las entradas del usuario de passenger_list
        const passengers = Array.isArray((tripData as any).passenger_list)
          ? [...(tripData as any).passenger_list]
          : [];

        const initialPassengerCount = passengers.length;
        let removedPassengerUid: string | null = null;
        const filteredPassengers = passengers.filter((p: any) => {
          if (typeof p === "string") {
            return p !== user_id;
          }
          if (p && typeof p === "object") {
            if (p.user_id === user_id) {
              // Guardar el firebase_uid de la primera entrada removida
              if (!removedPassengerUid && p.firebase_uid) {
                removedPassengerUid = p.firebase_uid;
              }
              return false; // Remover esta entrada
            }
          }
          return true;
        });
        const removedFromPassengerList = filteredPassengers.length < initialPassengerCount;
        passengers.length = 0;
        passengers.push(...filteredPassengers);
        const removedCountFromPassengerList = initialPassengerCount - passengers.length;
        if (removedCountFromPassengerList > 0) {
          console.log(`[Remove Passenger] Removed ${removedCountFromPassengerList} entry/entries from passenger_list, firebase_uid: ${removedPassengerUid}`);
        }

        // Remover TODAS las entradas del usuario de waitlist
        const waitlist = Array.isArray(tripData?.waitlist) ? [...tripData.waitlist] : [];
        const initialWaitlistCount = waitlist.length;
        const filteredWaitlist = waitlist.filter((w: any) => {
          if (typeof w === "string") {
            return w !== user_id;
          }
          if (w && typeof w === "object") {
            if (w.user_id === user_id) {
              // Guardar el firebase_uid de la primera entrada removida si aún no lo tenemos
              if (!removedPassengerUid && w.firebase_uid) {
                removedPassengerUid = w.firebase_uid;
              }
              return false; // Remover esta entrada
            }
          }
          return true;
        });
        const removedFromWaitlist = filteredWaitlist.length < initialWaitlistCount;
        waitlist.length = 0;
        waitlist.push(...filteredWaitlist);
        const removedCountFromWaitlist = initialWaitlistCount - waitlist.length;
        if (removedCountFromWaitlist > 0) {
          console.log(`[Remove Passenger] Removed ${removedCountFromWaitlist} entry/entries from waitlist`);
        }

        // Si no se encontró en ninguna lista, retornar error
        if (!removedFromPassengerList && !removedFromWaitlist) {
          return res.status(404).json({ 
            error: "Passenger not found in waitlist or passenger_list",
            debug: {
              user_id,
              passenger_list_length: passengers.length,
              waitlist_length: waitlist.length
            }
          });
        }

        // Verificar si el viaje estaba cerrado y ahora debe reabrirse
        const seatsAvailable = Number(tripData?.seats || 0);
        const passengersSeats = sumRequestedSeats(passengers);
        const shouldReopenTrip =
          tripData?.status === "closed" && seatsAvailable > 0 && passengersSeats < seatsAvailable;

        // Actualizar el viaje (remover de ambas listas si es necesario)
        const updateData: any = {
          updatedAt: new Date().toISOString(),
        };

        if (removedFromPassengerList) {
          updateData.passenger_list = passengers;
        }

        if (removedFromWaitlist) {
          updateData.waitlist = waitlist;
        }

        if (shouldReopenTrip) {
          updateData.status = "open";
          console.log(
            `[Remove Passenger] Trip ${trip_id} reopened: ${passengersSeats} cupos ocupados < ${seatsAvailable} disponibles`
          );
        }

        await tripRef.update(updateData);
        console.log(`[Remove Passenger] Updated trip ${trip_id} - passenger_list: ${passengers.length}, waitlist: ${waitlist.length}`);

        // Actualizar estado en my_trips del pasajero a "cancelled"
        if (removedPassengerUid) {
          try {
            const passengerUserRef = db.collection("users").doc(removedPassengerUid);
            const passengerUserDoc = await passengerUserRef.get();
            
            if (passengerUserDoc.exists) {
              const passengerUserData = passengerUserDoc.data();
              const myTrips = Array.isArray(passengerUserData?.my_trips) ? [...passengerUserData.my_trips] : [];
              
              const updatedTrips = myTrips.map((item: any) => {
                if (typeof item === "string") {
                  // Formato antiguo: convertir a objeto con estado cancelled
                  if (item === trip_id) {
                    return {
                      trip_id: trip_id,
                      firebase_uid: removedPassengerUid,
                      user_id: user_id,
                      status: "cancelled",
                      cancelledAt: new Date().toISOString(),
                      cancelledBy: "driver",
                    };
                  }
                  return item;
                }
                if (item && typeof item === "object" && item.trip_id === trip_id) {
                  // Actualizar el estado a "cancelled"
                  return {
                    ...item,
                    status: "cancelled",
                    cancelledAt: new Date().toISOString(),
                    cancelledBy: "driver",
                  };
                }
                return item;
              });

              await passengerUserRef.update({
                my_trips: updatedTrips,
                updatedAt: new Date().toISOString(),
              });
              console.log(`[Remove Passenger] Updated my_trips for passenger ${removedPassengerUid}, trip ${trip_id} to cancelled`);
            } else {
              console.log(`[Remove Passenger] Passenger user document ${removedPassengerUid} not found`);
            }
          } catch (userUpdateError: any) {
            console.error(`[Remove Passenger] Error updating passenger ${removedPassengerUid} my_trips:`, userUpdateError);
            // No fallar la operación principal si falla la actualización del usuario
          }
        } else {
          console.log(`[Remove Passenger] Could not extract passenger firebase_uid`);
        }

        console.log(`[Remove Passenger] Driver ${uid} removed passenger ${user_id} from trip ${trip_id}`);

        return res.status(200).json({
          message: "Passenger removed successfully",
          removed_from_passenger_list: removedFromPassengerList,
          removed_from_waitlist: removedFromWaitlist,
          passenger_list: passengers,
          waitlist: waitlist,
        });
      }

      // Acción "cancel_passenger": un pasajero cancela su participación (puede estar en waitlist o passenger_list)
      if (action === "cancel_passenger") {
        // Obtener user_id del usuario autenticado
        const userRef = db.collection("users").doc(uid);
        const userDoc = await userRef.get();
        let passengerUserId: string | null = null;
        
        if (userDoc.exists) {
          const userData = userDoc.data() as any;
          passengerUserId = userData?.user_id || null;
        }

        if (!passengerUserId) {
          return res.status(400).json({ error: "User ID not found. Please ensure your profile is complete." });
        }

        console.log(`[Cancel Passenger] Looking for passenger with user_id: ${passengerUserId}, firebase_uid: ${uid} in trip ${trip_id}`);

        // Buscar y remover de passenger_list
        const passengers = Array.isArray((tripData as any).passenger_list)
          ? [...(tripData as any).passenger_list]
          : [];

        // Remover TODAS las entradas del usuario de passenger_list
        const initialPassengerCount = passengers.length;
        const filteredPassengers = passengers.filter((p: any) => {
          if (typeof p === "string") {
            return p !== passengerUserId;
          }
          if (p && typeof p === "object") {
            return !(p.user_id === passengerUserId || p.firebase_uid === uid);
          }
          return true;
        });
        const removedFromPassengerList = filteredPassengers.length < initialPassengerCount;
        passengers.length = 0;
        passengers.push(...filteredPassengers);
        const removedCountFromPassengerList = initialPassengerCount - passengers.length;
        if (removedCountFromPassengerList > 0) {
          console.log(`[Cancel Passenger] Removed ${removedCountFromPassengerList} entry/entries from passenger_list`);
        }

        // Remover TODAS las entradas del usuario de waitlist
        const waitlist = Array.isArray(tripData?.waitlist) ? [...tripData.waitlist] : [];
        const initialWaitlistCount = waitlist.length;
        const filteredWaitlist = waitlist.filter((w: any) => {
          if (typeof w === "string") {
            return w !== passengerUserId;
          }
          if (w && typeof w === "object") {
            return !(w.user_id === passengerUserId || w.firebase_uid === uid);
          }
          return true;
        });
        const removedFromWaitlist = filteredWaitlist.length < initialWaitlistCount;
        waitlist.length = 0;
        waitlist.push(...filteredWaitlist);
        const removedCountFromWaitlist = initialWaitlistCount - waitlist.length;
        if (removedCountFromWaitlist > 0) {
          console.log(`[Cancel Passenger] Removed ${removedCountFromWaitlist} entry/entries from waitlist`);
        }

        // Si no se encontró en ninguna lista, retornar error
        if (!removedFromPassengerList && !removedFromWaitlist) {
          return res.status(404).json({ 
            error: "Passenger not found in waitlist or passenger_list",
            debug: {
              passengerUserId,
              firebase_uid: uid,
              passenger_list_length: passengers.length,
              waitlist_length: waitlist.length
            }
          });
        }

        // Verificar si el viaje estaba cerrado y ahora debe reabrirse
        const seatsAvailable = Number(tripData?.seats || 0);
        const passengersSeats = sumRequestedSeats(passengers);
        const shouldReopenTrip =
          tripData?.status === "closed" && seatsAvailable > 0 && passengersSeats < seatsAvailable;

        // Actualizar el viaje (remover de ambas listas si es necesario)
        const updateData: any = {
          updatedAt: new Date().toISOString(),
        };

        if (removedFromPassengerList) {
          updateData.passenger_list = passengers;
        }

        if (removedFromWaitlist) {
          updateData.waitlist = waitlist;
        }

        if (shouldReopenTrip) {
          updateData.status = "open";
          console.log(
            `[Cancel Passenger] Trip ${trip_id} reopened: ${passengersSeats} cupos ocupados < ${seatsAvailable} disponibles`
          );
        }

        await tripRef.update(updateData);
        console.log(`[Cancel Passenger] Updated trip ${trip_id} - passenger_list: ${passengers.length}, waitlist: ${waitlist.length}`);

        // Remover completamente el viaje de my_trips del usuario
        if (userDoc.exists) {
          const userData = userDoc.data();
          const myTrips = Array.isArray(userData?.my_trips) ? [...userData.my_trips] : [];
          console.log(`[Cancel Passenger] Current my_trips length: ${myTrips.length}`);
          
          const updatedTrips = myTrips.filter((item: any) => {
            if (typeof item === "string") {
              return item !== trip_id; // Remover si es el trip_id
            }
            if (item && typeof item === "object" && item.trip_id === trip_id) {
              console.log(`[Cancel Passenger] Removing trip object from my_trips:`, item);
              return false; // Remover este viaje completamente
            }
            return true; // Mantener los demás viajes
          });

          console.log(`[Cancel Passenger] Updated my_trips length: ${updatedTrips.length}`);

          await userRef.update({
            my_trips: updatedTrips,
            updatedAt: new Date().toISOString(),
          });
          console.log(`[Cancel Passenger] Removed trip ${trip_id} from my_trips for user ${uid}`);
        }

        const driverUid =
          (typeof tripData?.driver_uid === "string" && tripData.driver_uid) ||
          (typeof tripData?.driver_id === "string" && tripData.driver_id) ||
          null;
        if (driverUid && driverUid !== uid) {
          const passengerName = userDoc.exists
            ? getUserDisplayName(userDoc.data(), passengerUserId)
            : passengerUserId;
          const tripTitle =
            (typeof tripData?.destination?.address === "string" && tripData.destination.address) ||
            (typeof tripData?.start?.address === "string" && tripData.start.address) ||
            "tu viaje";
          await createUserNotification(db, {
            uidDestino: driverUid,
            type: "applicationCancelled",
            tripId: trip_id,
            message: `${passengerName} canceló su participación en "${tripTitle}"`,
            payload: {
              passengerUid: uid,
              passengerName,
              tripId: trip_id,
            },
          });
        }

        console.log(`[Cancel Passenger] User ${uid} cancelled participation in trip ${trip_id}`);

        return res.status(200).json({
          message: "Passenger participation cancelled successfully",
          removed_from_passenger_list: removedFromPassengerList,
          removed_from_waitlist: removedFromWaitlist,
          passenger_list: passengers,
          waitlist: waitlist,
        });
      }

      // Para las demás acciones (accept, apply), user_id es requerido
      if (!user_id) {
        return res.status(400).json({ error: "user_id is required" });
      }
      
      // Registro completo de la aplicación (se reutiliza para waitlist y my_trips)
      const applicationRecord: any = {
        trip_id,
        firebase_uid: uid,
        user_id,
        requested_seats: requestedSeats,
        origin:
          origin && typeof origin === "object"
            ? {
                address: String((origin as any).address || ""),
                coordinates:
                  (origin as any).coordinates && typeof (origin as any).coordinates === "object"
                    ? {
                        lat: Number((origin as any).coordinates.lat) || null,
                        lng: Number((origin as any).coordinates.lng) || null,
                      }
                    : null,
              }
            : null,
        destination:
          destination && typeof destination === "object"
            ? {
                address: String((destination as any).address || ""),
                coordinates:
                  (destination as any).coordinates &&
                  typeof (destination as any).coordinates === "object"
                    ? {
                        lat: Number((destination as any).coordinates.lat) || null,
                        lng: Number((destination as any).coordinates.lng) || null,
                      }
                    : null,
              }
            : null,
        status: "waitlist",
        appliedAt: new Date().toISOString(),
      };

      const waitlist = Array.isArray(tripData?.waitlist) ? [...tripData.waitlist] : [];

      // Si la acción es "accept", mover de waitlist a passenger_list
      if (action === "accept") {
        // Solo el conductor del viaje puede aceptar pasajeros
        if (tripData?.driver_uid !== uid && tripData?.driver_id !== uid) {
          return res.status(403).json({ error: "Only the driver can accept passengers" });
        }

        const passengers = Array.isArray((tripData as any).passenger_list)
          ? [...(tripData as any).passenger_list]
          : [];

        const index = waitlist.findIndex((item: any) => {
          if (typeof item === "string") return item === user_id;
          if (item && typeof item === "object" && typeof item.user_id === "string") {
            return item.user_id === user_id;
          }
          return false;
        });

        if (index === -1) {
          return res.status(404).json({ error: "User not found in waitlist" });
        }

        const entry = waitlist[index];
        const passengerRecord =
          entry && typeof entry === "object"
            ? { ...entry, status: "accepted" }
            : { ...applicationRecord, status: "accepted", movedFrom: "waitlist" };

        waitlist.splice(index, 1);
        const seatsAvailable = Number(tripData?.seats || 0);
        const seatCountBefore = passengers.length;
        // Cada entrada representa 1 cupo
        const passengerSeatsRequested = 1;

        if (seatsAvailable > 0 && seatCountBefore + passengerSeatsRequested > seatsAvailable) {
          return res.status(400).json({
            error: "No hay suficientes asientos disponibles para aceptar esta solicitud",
          });
        }

        passengers.push(passengerRecord);

        // Actualizar estado en my_trips del PASAJERO ANTES de actualizar el trip (simultáneo)
        // Solo actualizar UNA entrada (la primera con status "waitlist" para este trip_id)
        let passengerUid: string | null = null;
        let passengerUserIdFromEntry: string | null = null;
        if (entry && typeof entry === "object") {
          passengerUid = (entry as any).firebase_uid || null;
          passengerUserIdFromEntry = (entry as any).user_id || null;
        }
        
        // Usar el user_id del entry si está disponible, de lo contrario usar el del body
        const passengerUserIdToMatch = passengerUserIdFromEntry || user_id;
        
        console.log(`[Accept] Accepting passenger - user_id from body: ${user_id}, user_id from entry: ${passengerUserIdFromEntry}, using: ${passengerUserIdToMatch}`);
        console.log(`[Accept] Passenger UID: ${passengerUid}`);

        // Actualizar el documento del pasajero simultáneamente
        if (passengerUid) {
          try {
            const userRef = db.collection("users").doc(passengerUid);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
              const userData = userDoc.data() as any;
              const myTrips = Array.isArray(userData?.my_trips) ? [...userData.my_trips] : [];
              
              console.log(`[Accept] Searching for trip ${trip_id} in my_trips of user ${passengerUid}`);
              console.log(`[Accept] Current my_trips entries for this trip:`, myTrips.filter((t: any) => t && typeof t === "object" && t.trip_id === trip_id));
              
              // Encontrar la primera entrada con status "waitlist" para este trip_id y user_id
              let foundOne = false;
              const updatedTrips = myTrips.map((t: any) => {
                if (!t || typeof t !== "object") return t;
                
                const matchesTrip = t.trip_id === trip_id;
                const matchesUser = t.user_id === passengerUserIdToMatch;
                const isWaitlist = t.status === "waitlist";
                
                if (
                  !foundOne &&
                  matchesTrip &&
                  isWaitlist &&
                  matchesUser
                ) {
                  foundOne = true;
                  console.log(`[Accept] ✅ Found matching entry to update:`, t);
                  return { ...t, status: "accepted" };
                }
                return t;
              });

              // Verificar si realmente hubo un cambio
              const hasChange = JSON.stringify(myTrips) !== JSON.stringify(updatedTrips);
              if (hasChange) {
                await userRef.update({
                  my_trips: updatedTrips,
                  updatedAt: new Date().toISOString(),
                });
                console.log(`[Accept] ✅ Updated one entry in my_trips for user ${passengerUid}, trip ${trip_id} to accepted`);
                console.log(`[Accept] Updated entry:`, updatedTrips.find((t: any) => t && typeof t === "object" && t.trip_id === trip_id && t.status === "accepted"));
              } else {
                console.log(`[Accept] ⚠️ No change detected for user ${passengerUid}, trip ${trip_id}`);
                console.log(`[Accept] Debug - Original entries:`, myTrips.filter((t: any) => t && typeof t === "object" && t.trip_id === trip_id));
                console.log(`[Accept] Debug - Updated entries:`, updatedTrips.filter((t: any) => t && typeof t === "object" && t.trip_id === trip_id));
                console.log(`[Accept] Debug - Looking for: trip_id=${trip_id}, user_id=${passengerUserIdToMatch}, status=waitlist`);
              }
            } else {
              console.log(`[Accept] User document ${passengerUid} not found`);
            }
          } catch (userUpdateError: any) {
            console.error(`[Accept] Error updating user ${passengerUid} my_trips:`, userUpdateError);
            // No fallar la operación principal si falla la actualización del usuario
          }
        } else {
          console.log(`[Accept] ⚠️ Could not extract passengerUid from entry`);
          console.log(`[Accept] Entry data:`, entry);
        }

        // Verificar si se alcanzó el número máximo de asientos disponibles
        // Cada entrada en passenger_list representa 1 cupo
        const occupiedSeats = passengers.length;
        const shouldCloseTrip = seatsAvailable > 0 && occupiedSeats >= seatsAvailable;

        // Actualizar el trip (waitlist, passenger_list y status si es necesario)
        const updateData: any = {
          waitlist,
          passenger_list: passengers,
          updatedAt: new Date().toISOString(),
        };

        if (shouldCloseTrip && tripData?.status === "open") {
          updateData.status = "closed";
          console.log(
            `[Accept] Trip ${trip_id} closed: ${occupiedSeats} seats ocupados >= ${seatsAvailable} disponibles`
          );
        }

        await tripRef.update(updateData);

        // Crear notificación para el pasajero que fue aceptado
        if (passengerUid) {
          const tripTitle = tripData?.start?.address && tripData?.destination?.address
            ? `${tripData.start.address} → ${tripData.destination.address}`
            : "tu viaje";
          
          await createUserNotification(db, {
            uidDestino: passengerUid,
            type: "applicationSuccess",
            tripId: trip_id,
            message: `Tu solicitud fue aceptada para el viaje: ${tripTitle}`,
            payload: {
              tripId: trip_id,
              origin: tripData?.start?.address || null,
              destination: tripData?.destination?.address || null,
              driverUid: uid,
            },
          });
        }

        return res.status(200).json({
          message: "User moved to passenger_list",
          waitlist,
          passenger_list: passengers,
        });
      }

      // Acción por defecto: aplicar al viaje (agregar a waitlist)
      // Verificar si el usuario es el conductor del viaje (no puede aplicarse a su propio viaje)
      console.log(`[PATCH /api/trips] Default action (apply) - driver_uid: ${tripData?.driver_uid}, driver_id: ${tripData?.driver_id}, uid: ${uid}`);
      if (tripData?.driver_uid === uid || tripData?.driver_id === uid) {
        console.log(`[PATCH /api/trips] ERROR: User ${uid} trying to apply to their own trip ${trip_id}`);
        return res.status(400).json({ error: "You cannot apply to your own trip" });
      }

      // Verificar que el viaje no esté cerrado
      if (tripData?.status === "closed") {
        return res.status(400).json({ error: "Este viaje ya está lleno y no acepta más pasajeros" });
      }

      // Verificar cupos disponibles antes de permitir la aplicación
      const passengers = Array.isArray((tripData as any).passenger_list)
        ? [...(tripData as any).passenger_list]
        : [];
      const seatsAvailable = Number(tripData?.seats || 0);
      const occupiedSeatsInPassengerList = passengers.length;
      const occupiedSeatsInWaitlist = waitlist.length;
      const totalOccupiedSeats = occupiedSeatsInPassengerList + occupiedSeatsInWaitlist;
      const seatsRequested = requestedSeats || 1;

      if (seatsAvailable > 0 && totalOccupiedSeats + seatsRequested > seatsAvailable) {
        return res.status(400).json({
          error: `No hay suficientes cupos disponibles. Solo quedan ${Math.max(0, seatsAvailable - totalOccupiedSeats)} cupo(s) disponible(s).`,
        });
      }

      // Crear X entradas idénticas en waitlist (una por cada cupo solicitado)
      // Cada entrada representa 1 cupo, sin el campo requested_seats
      const { requested_seats, ...entryWithoutRequestedSeats } = applicationRecord;
      
      const waitlistBeforeLength = waitlist.length;
      console.log(`[PATCH /api/trips] Creating ${seatsRequested} entries in waitlist. Current waitlist length: ${waitlistBeforeLength}`);
      console.log(`[PATCH /api/trips] Entry template (without requested_seats):`, JSON.stringify(entryWithoutRequestedSeats));
      
      for (let i = 0; i < seatsRequested; i++) {
        waitlist.push({ ...entryWithoutRequestedSeats });
      }
      
      const waitlistAfterLength = waitlist.length;
      console.log(`[PATCH /api/trips] Created ${waitlistAfterLength - waitlistBeforeLength} entries. New waitlist length: ${waitlistAfterLength}`);

      await tripRef.update({
        waitlist,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`[PATCH /api/trips] Updated trip ${trip_id} waitlist with ${waitlist.length} entries`);

      // Agregar la aplicación del viaje a la lista my_trips del usuario (como objeto)
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();
      
      let applicantCodeFromDoc: string | null = null;
      if (userDoc.exists) {
        const userData = userDoc.data();
        applicantCodeFromDoc = userData?.user_id || null;
        const myTrips = Array.isArray(userData?.my_trips) ? [...userData.my_trips] : [];
        
        // Agregar X entradas idénticas a my_trips (una por cada cupo solicitado)
        // Cada entrada representa 1 cupo, sin el campo requested_seats
        const myTripsBeforeLength = myTrips.length;
        console.log(`[PATCH /api/trips] Adding ${seatsRequested} entries to my_trips. Current my_trips length: ${myTripsBeforeLength}`);
        
        for (let i = 0; i < seatsRequested; i++) {
          myTrips.push({ ...entryWithoutRequestedSeats });
        }
        
        const myTripsAfterLength = myTrips.length;
        console.log(`[PATCH /api/trips] Added ${myTripsAfterLength - myTripsBeforeLength} entries. New my_trips length: ${myTripsAfterLength}`);

        await userRef.update({
          my_trips: myTrips,
          updatedAt: new Date().toISOString(),
        });
      }

      const applicantCode = applicantCodeFromDoc || user_id || null;

      await addTripMessage(db, trip_id, {
        type: "application",
        message: `El usuario ${applicantCode || uid} aplicó a este viaje (${requestedSeats} cupo${
          requestedSeats === 1 ? "" : "s"
        })`,
        payload: {
          applicantUid: uid,
          applicantUserId: applicantCode,
          requestedSeats,
        },
      });

      const driverUid =
        (typeof tripData?.driver_uid === "string" && tripData.driver_uid) ||
        (typeof tripData?.driver_id === "string" && tripData.driver_id) ||
        null;
      if (driverUid && driverUid !== uid) {
        const applicantName = userDoc.exists
          ? getUserDisplayName(userDoc.data(), decodedToken.email?.split("@")[0])
          : decodedToken.email?.split("@")[0] || "Un usuario";
        await createUserNotification(db, {
          uidDestino: driverUid,
          type: "tripApplication",
          tripId: trip_id,
          message: `${applicantName} aplicó a tu viaje`,
          payload: {
            applicantUid: uid,
            applicantName,
          },
        });
      }

      // Crear notificación para el usuario que aplica
      const cuposText = seatsRequested === 1 ? "cupo" : "cupos";
      const applicationMessage = `Aplicaste ${seatsRequested} ${cuposText} exitosamente`;
      
      await createUserNotification(db, {
        uidDestino: uid,
        type: "applicationSuccess",
        tripId: trip_id,
        message: applicationMessage,
        payload: {
          tripId: trip_id,
          seatsRequested,
          origin: origin && typeof origin === "object" ? origin.address : null,
          destination: destination && typeof destination === "object" ? destination.address : null,
        },
      });

      return res.status(200).json({ 
        message: applicationMessage, 
        waitlist 
      });
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
