import { inspect } from "node:util";

const DEFAULT_ACCEPT_LANGUAGE =
  "en,es;q=0.9,en-US;q=0.8,pt-BR;q=0.7,pt;q=0.6";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

async function main() {
  const config = loadConfig();
  logSection("config", {
    baseUrl: config.baseUrl,
    username: mask(config.username),
    password: config.password ? "***" : "",
    userType: config.userType,
    loginRedirect: config.loginRedirect,
    hasBootstrapCookie: Boolean(config.cookie),
  });

  const cookieJar = new Map();

  if (config.cookie) {
    mergeCookieHeader(cookieJar, config.cookie);
    logSection("bootstrap-cookie", {
      cookies: listCookieNames(cookieJar),
    });
  }

  await primeLogin(config, cookieJar);
  await login(config, cookieJar);

  const listPayload = await listChamados(config, cookieJar);
  const items = normalizeChamadoCollection(listPayload.body);

  logSection("chamados-json", {
    status: listPayload.response.status,
    itemCount: items.length,
    topLevelKeys: listPayload.body && typeof listPayload.body === "object"
      ? Object.keys(listPayload.body).slice(0, 20)
      : [],
    firstItem: items[0] ? summarizeChamado(items[0]) : null,
  });

  const desiredId = getRequestedId() ?? items[0]?.cd_chamado;
  if (!desiredId) {
    logSection("detalhe", {
      message: "Nenhum chamado disponivel para testar detalhe.",
    });
    return;
  }

  await detailChamado(config, cookieJar, desiredId);
}

function loadConfig() {
  const baseUrl = (process.env.SOFTDESK_BASE_URL ?? "https://softdesk.soft4.com.br").trim().replace(/\/+$/, "");
  const username = (process.env.SOFTDESK_USERNAME ?? "").trim();
  const password = (process.env.SOFTDESK_PASSWORD ?? "").trim();
  const userType = (process.env.SOFTDESK_USER_TYPE ?? "A").trim() || "A";
  const loginRedirect = (process.env.SOFTDESK_LOGIN_REDIRECT ?? "/chamado").trim() || "/chamado";

  if (!baseUrl) {
    throw new Error("SOFTDESK_BASE_URL nao configurado.");
  }

  if (!username || !password) {
    throw new Error("SOFTDESK_USERNAME e SOFTDESK_PASSWORD sao obrigatorios para este teste.");
  }

  return {
    baseUrl,
    username,
    password,
    userType,
    loginRedirect,
    acceptLanguage: (process.env.SOFTDESK_ACCEPT_LANGUAGE ?? DEFAULT_ACCEPT_LANGUAGE).trim(),
    userAgent: (process.env.SOFTDESK_USER_AGENT ?? DEFAULT_USER_AGENT).trim(),
    cookie: (process.env.SOFTDESK_COOKIE ?? "").trim(),
    explicitXsrfToken: (process.env.SOFTDESK_XSRF_TOKEN ?? "").trim(),
    csrfToken: (process.env.SOFTDESK_CSRF_TOKEN ?? "").trim(),
    sendCsrfToken: toBoolean(process.env.SOFTDESK_SEND_CSRF_TOKEN),
  };
}

async function primeLogin(config, cookieJar) {
  const response = await fetchWithRedirectChain(`${config.baseUrl}/login`, {
    method: "GET",
    headers: {
      Referer: `${config.baseUrl}/login`,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": config.acceptLanguage,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": config.userAgent,
      Cookie: toCookieHeader(cookieJar),
    },
  }, cookieJar);

  logSection("prime-login", {
    status: response.status,
    redirected: response.redirected,
    url: response.url,
    setCookieNames: getSetCookieNames(response),
    cookiesAfter: listCookieNames(cookieJar),
    xsrfTokenPresent: Boolean(getXsrfToken(cookieJar, config)),
  });
}

async function login(config, cookieJar) {
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": config.acceptLanguage,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Origin: config.baseUrl,
    Priority: "u=1, i",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": config.userAgent,
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    Referer: `${config.baseUrl}/login?_redirect=%2Fchamado`,
    Cookie: toCookieHeader(cookieJar),
  };

  const xsrfToken = getXsrfToken(cookieJar, config);
  if (xsrfToken) {
    headers["X-XSRF-TOKEN"] = xsrfToken;
  }
  if (config.sendCsrfToken && config.csrfToken) {
    headers["X-CSRF-TOKEN"] = config.csrfToken;
  }

  const response = await fetch(`${config.baseUrl}/login`, {
    method: "POST",
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      lg_usuario: config.username,
      sh_usuario: config.password,
      tp_usuario: config.userType,
      resposta: "",
      redirect_by_url: config.loginRedirect,
    }),
  });

  mergeSetCookie(cookieJar, response);
  const bodyText = await response.text();

  logSection("login", {
    status: response.status,
    location: response.headers.get("location"),
    contentType: response.headers.get("content-type"),
    setCookieNames: getSetCookieNames(response),
    cookiesAfter: listCookieNames(cookieJar),
    bodyPreview: bodyText.slice(0, 500),
  });

  if (!response.ok) {
    throw new Error(`Login falhou com status ${response.status}.`);
  }
}

async function listChamados(config, cookieJar) {
  const params = new URLSearchParams({
    cd_pasta: process.env.SOFTDESK_TEST_CD_PASTA ?? "1",
    cd_area: process.env.SOFTDESK_TEST_CD_AREA ?? "0",
    cd_cliente: process.env.SOFTDESK_TEST_CD_CLIENTE ?? "0",
    cd_grupo_solucao: process.env.SOFTDESK_TEST_CD_GRUPO_SOLUCAO ?? "0",
    tp_requisicao: process.env.SOFTDESK_TEST_TP_REQUISICAO ?? "EM_ATENDIMENTO",
    tp_usuario: process.env.SOFTDESK_TEST_TP_USUARIO ?? "ATE",
    start: process.env.SOFTDESK_TEST_START ?? "0",
    limit: process.env.SOFTDESK_TEST_LIMIT ?? "10",
  });

  const response = await fetch(`${config.baseUrl}/chamado/json?${params.toString()}`, {
    method: "GET",
    headers: buildAuthHeaders(config, cookieJar, `${config.baseUrl}/chamado`),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });

  mergeSetCookie(cookieJar, response);
  const body = await decodeBody(response);

  if (!response.ok) {
    logSection("chamados-json-error", {
      status: response.status,
      location: response.headers.get("location"),
      bodyPreview: typeof body === "string" ? body.slice(0, 500) : inspect(body, { depth: 3 }),
    });
    throw new Error(`Consulta de chamados falhou com status ${response.status}.`);
  }

  return { response, body };
}

async function detailChamado(config, cookieJar, chamadoId) {
  const referer = `${config.baseUrl}/chamado/detalhe/${chamadoId}`;
  const attempts = [
    {
      name: "POST /chamado/detalhe/{id}/json",
      path: `${config.baseUrl}/chamado/detalhe/${chamadoId}/json`,
      init: { method: "POST", headers: buildAuthHeaders(config, cookieJar, referer) },
    },
    {
      name: "GET /chamado/detalhe/{id}/json",
      path: `${config.baseUrl}/chamado/detalhe/${chamadoId}/json`,
      init: { method: "GET", headers: buildAuthHeaders(config, cookieJar, referer) },
    },
    {
      name: "GET /chamado/detalhe/json?cd_chamado={id}",
      path: `${config.baseUrl}/chamado/detalhe/json?cd_chamado=${chamadoId}`,
      init: { method: "GET", headers: buildAuthHeaders(config, cookieJar, referer) },
    },
    {
      name: "GET /chamado/{id}/json",
      path: `${config.baseUrl}/chamado/${chamadoId}/json`,
      init: { method: "GET", headers: buildAuthHeaders(config, cookieJar, referer) },
    },
    {
      name: "POST /chamado/detalhe/json",
      path: `${config.baseUrl}/chamado/detalhe/json`,
      init: {
        method: "POST",
        headers: {
          ...buildAuthHeaders(config, cookieJar, referer),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ cd_chamado: String(chamadoId) }),
      },
    },
  ];

  for (const attempt of attempts) {
    const response = await fetch(attempt.path, {
      ...attempt.init,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    mergeSetCookie(cookieJar, response);
    const body = await decodeBody(response);

    logSection(`detalhe ${attempt.name}`, {
      status: response.status,
      location: response.headers.get("location"),
      contentType: response.headers.get("content-type"),
      bodyPreview:
        typeof body === "string"
          ? body.slice(0, 500)
          : inspect(summarizeUnknown(body), { depth: 3 }),
    });

    if (response.ok) {
      return;
    }
  }
}

function buildAuthHeaders(config, cookieJar, referer) {
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": config.acceptLanguage,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Origin: config.baseUrl,
    Priority: "u=1, i",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": config.userAgent,
    "X-Requested-With": "XMLHttpRequest",
    Referer: referer,
    Cookie: toCookieHeader(cookieJar),
  };

  const xsrfToken = getXsrfToken(cookieJar, config);
  if (xsrfToken) {
    headers["X-XSRF-TOKEN"] = xsrfToken;
  }
  if (config.sendCsrfToken && config.csrfToken) {
    headers["X-CSRF-TOKEN"] = config.csrfToken;
  }

  return headers;
}

function normalizeChamadoCollection(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.lista)) {
    return payload.lista;
  }

  for (const key of ["data", "items", "rows", "results", "chamados"]) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return [];
}

async function decodeBody(response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return "<json invalido>";
    }
  }

  return response.text();
}

function getRequestedId() {
  const arg = process.argv.find((entry) => entry.startsWith("--id="));
  if (!arg) {
    return null;
  }

  const value = Number(arg.slice("--id=".length));
  return Number.isFinite(value) ? value : null;
}

function getXsrfToken(cookieJar, config) {
  const token = cookieJar.get("XSRF-TOKEN");
  if (token) {
    try {
      return decodeURIComponent(token);
    } catch {
      return token;
    }
  }

  return config.explicitXsrfToken || "";
}

function mergeSetCookie(cookieJar, response) {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const header of setCookies) {
    const [pair] = header.split(";");
    const separator = pair.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    cookieJar.set(name, value);
  }
}

function mergeCookieHeader(cookieJar, header) {
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      continue;
    }
    cookieJar.set(trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim());
  }
}

function toCookieHeader(cookieJar) {
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function listCookieNames(cookieJar) {
  return Array.from(cookieJar.keys());
}

function getSetCookieNames(response) {
  return (response.headers.getSetCookie?.() ?? []).map((header) => header.split("=")[0]);
}

async function fetchWithRedirectChain(url, init, cookieJar) {
  let currentUrl = url;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const headers = {
      ...(init.headers ?? {}),
      Cookie: toCookieHeader(cookieJar),
    };

    const response = await fetch(currentUrl, {
      ...init,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });

    mergeSetCookie(cookieJar, response);

    const location = response.headers.get("location");
    if (!location || response.status < 300 || response.status >= 400) {
      return response;
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error("Cadeia de redirect do /login excedeu o limite esperado.");
}

function summarizeChamado(item) {
  return {
    cd_chamado: item.cd_chamado,
    tt_chamado: item.tt_chamado,
    ds_status: item.ds_status,
    nm_cliente: item.nm_cliente,
    nm_atendente: item.nm_atendente,
    nr_anexo: item.nr_anexo,
  };
}

function summarizeUnknown(value) {
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      first: value[0] ?? null,
    };
  }

  if (value && typeof value === "object") {
    return {
      type: "object",
      keys: Object.keys(value).slice(0, 20),
      preview: value,
    };
  }

  return value;
}

function logSection(title, payload) {
  console.log(`\n=== ${title.toUpperCase()} ===`);
  console.log(inspect(payload, { depth: 6, colors: true, maxArrayLength: 30 }));
}

function mask(value) {
  if (!value) {
    return "";
  }

  if (value.length <= 2) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 2)}***${value.slice(-1)}`;
}

function toBoolean(value) {
  return ["1", "true", "sim", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

main().catch((error) => {
  console.error("\n=== FALHA ===");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
