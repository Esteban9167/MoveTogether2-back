export function computeCorsOrigin(origin: string | undefined, allowedOriginEnv: string | undefined) {
  const allowedOrigin = (allowedOriginEnv || "").trim();

  if (!allowedOrigin || allowedOrigin === "*") {
    return origin || "*";
  }

  const allowList = allowedOrigin
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const isAllowed = (value?: string) => {
    if (!value) return false;
    if (allowList.includes(value)) return true;

    try {
      const url = new URL(value);
      const hostname = url.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") return true;
      if (hostname.endsWith(".vercel.app")) return true;
    } catch {
      if (value.includes("localhost") || value.includes("127.0.0.1")) return true;
      if (value.endsWith(".vercel.app")) return true;
    }

    return false;
  };

  if (isAllowed(origin)) {
    return origin || allowList[0] || "*";
  }

  return allowList[0] || "*";
}





