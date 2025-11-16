import type { VercelRequest, VercelResponse } from "@vercel/node";
import loginHandler from "../../src/auth/login";
import googleHandler from "../../src/auth/google";
import loginGoogleHandler from "../../src/auth/login-google";
import verifyHandler from "../../src/auth/verify";
import ensureUserHandler from "../../src/auth/ensure-user";
import registerHandler from "../../src/auth/register";
import resetPasswordHandler from "../../src/auth/reset-password";
import sendResetLinkHandler from "../../src/auth/send-reset-link";
import sendUnisabanaResetLink from "../../src/auth/send-unisabana-reset-link";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Obtener la ruta desde la URL
  const url = req.url || "";
  const path = url.split("?")[0] || "";
  
  // Normalizar path (quitar / al final)
  const normalizedPath = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
  
  // Routing interno para /api/auth/*
  if (normalizedPath === "/api/auth/login") {
    return loginHandler(req, res);
  }
  
  if (normalizedPath === "/api/auth/google") {
    return googleHandler(req, res);
  }
  
  if (normalizedPath === "/api/auth/login-google") {
    return loginGoogleHandler(req, res);
  }
  
  if (normalizedPath === "/api/auth/verify") {
    return verifyHandler(req, res);
  }
  
  if (normalizedPath === "/api/auth/ensure-user") {
    return ensureUserHandler(req, res);
  }
  
  if (normalizedPath === "/api/auth/register") {
    return registerHandler(req, res);
  }
  
  if (normalizedPath === "/api/auth/reset-password") {
    return resetPasswordHandler(req, res);
  }
  
  if (normalizedPath === "/api/auth/send-reset-link") {
    return sendResetLinkHandler(req, res);
  }
  
  if (normalizedPath === "/api/auth/send-unisabana-reset-link") {
    return sendUnisabanaResetLink(req, res);
  }
  
  // Si no coincide ninguna ruta
  return res.status(404).json({ error: "Route not found", path: normalizedPath });
}

