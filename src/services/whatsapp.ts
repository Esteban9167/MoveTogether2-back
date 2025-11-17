import makeWASocket, {
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";

let socketPromise: Promise<WASocket> | null = null;

async function createSocket() {
  const { state, saveCreds } = await useMultiFileAuthState("./baileys_auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: process.env.WA_LOG_LEVEL || "info" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, qr }) => {
    if (qr) {
      console.log("👇 Escanea este QR con la cuenta de WhatsApp que actuará como bot 👇");
      qrcode.generate(qr, { small: true });
    }
    if (connection) {
      console.log(`[Baileys] Estado de conexión: ${connection}`);
    }
  });

  return sock;
}

async function getSocket() {
  if (!socketPromise) {
    socketPromise = createSocket();
  }
  return socketPromise;
}

function normalizeNumber(phone: string) {
  const digits = phone.replace(/[^0-9]/g, "");
  return digits.includes("@s.whatsapp.net") ? digits : `${digits}@s.whatsapp.net`;
}

export async function sendWhatsappText(to: string, message: string) {
  if (!to || !message) {
    throw new Error("Número y mensaje son obligatorios");
  }
  const sock = await getSocket();
  const jid = normalizeNumber(to);
  await sock.sendMessage(jid, { text: message });
  return { to: jid, status: "sent" };
}

export async function ensureWhatsappReady() {
  await getSocket();
}

