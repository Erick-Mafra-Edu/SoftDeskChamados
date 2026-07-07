import { credentialsSchema } from "@/lib/softdesk/schema";

export function loadSoftdeskConfig() {
  return credentialsSchema.parse({
    baseUrl: process.env.SOFTDESK_BASE_URL,
    username: process.env.SOFTDESK_USERNAME,
    password: process.env.SOFTDESK_PASSWORD,
    userType: process.env.SOFTDESK_USER_TYPE ?? "A",
    loginRedirect: process.env.SOFTDESK_LOGIN_REDIRECT ?? "/chamado",
    acceptLanguage:
      process.env.SOFTDESK_ACCEPT_LANGUAGE ??
      "en,es;q=0.9,en-US;q=0.8,pt-BR;q=0.7,pt;q=0.6",
    userAgent:
      process.env.SOFTDESK_USER_AGENT ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    cookie: process.env.SOFTDESK_COOKIE,
    xsrfToken: process.env.SOFTDESK_XSRF_TOKEN,
    csrfToken: process.env.SOFTDESK_CSRF_TOKEN,
    sendCsrfToken: process.env.SOFTDESK_SEND_CSRF_TOKEN ?? "false",
  });
}
