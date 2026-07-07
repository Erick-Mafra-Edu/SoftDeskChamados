import { SoftdeskCookieStore } from "@/lib/softdesk/cookie-store";
import type { SoftdeskCredentials } from "@/lib/softdesk/schema";

type RequestOptions = RequestInit & {
  referer?: string;
  timeoutMs?: number;
};

export class SoftdeskSessionManager {
  private readonly cookieStore: SoftdeskCookieStore;
  private authenticatedAt?: string;
  private loginInFlight?: Promise<void>;

  constructor(private readonly credentials: SoftdeskCredentials) {
    this.cookieStore = new SoftdeskCookieStore(credentials.cookie);
  }

  absoluteUrl(path: string) {
    if (!this.credentials.baseUrl) {
      throw new Error("SOFTDESK_BASE_URL nao configurado.");
    }

    return new URL(path, this.credentials.baseUrl).toString();
  }

  async ensureAuthenticated() {
    if (this.loginInFlight) {
      await this.loginInFlight;
      return;
    }

    if (this.hasCredentials()) {
      if (this.authenticatedAt && this.cookieStore.list().length > 0) {
        return;
      }

      this.loginInFlight = this.authenticateWithLogin();
      try {
        await this.loginInFlight;
      } finally {
        this.loginInFlight = undefined;
      }

      return;
    }

    if (this.cookieStore.list().length > 0) {
      return;
    }

    if (!this.credentials.baseUrl) {
      return;
    }

    throw new Error(
      "Sessao Softdesk indisponivel. Configure usuario/senha no .env ou informe um cookie valido.",
    );
  }

  async request(path: string, init: RequestOptions = {}) {
    if (!this.credentials.baseUrl) {
      throw new Error("SOFTDESK_BASE_URL nao configurado.");
    }

    await this.ensureAuthenticated();

    const response = await this.performFetch(path, init, new Headers(init.headers));

    this.captureSetCookie(response);

    if (this.shouldRetryWithLogin(response) && this.hasCredentials()) {
      await this.reauthenticate();

      const retryHeaders = new Headers(init.headers);
      const retryResponse = await this.performFetch(path, init, retryHeaders);
      this.captureSetCookie(retryResponse);
      return retryResponse;
    }

    return response;
  }

  snapshot() {
    return {
      authenticatedAt: this.authenticatedAt,
      authMode: this.hasCredentials() ? "login" : "cookie",
      cookies: this.cookieStore.list(),
      hasXsrfToken: Boolean(this.cookieStore.xsrfToken() || this.credentials.xsrfToken),
    };
  }

  private hasCredentials() {
    return Boolean(
      this.credentials.baseUrl && this.credentials.username && this.credentials.password,
    );
  }

  private async authenticateWithLogin() {
    this.cookieStore.clear();
    await this.bootstrapLoginPage();
    await this.login();
    this.authenticatedAt = new Date().toISOString();
  }

  private async reauthenticate() {
    this.authenticatedAt = undefined;
    await this.authenticateWithLogin();
  }

  private async performFetch(path: string, init: RequestOptions, headers: Headers) {
    const baseUrl = this.credentials.baseUrl ?? "";
    headers.set("Accept", "application/json, text/plain, */*");
    headers.set(
      "Accept-Language",
      this.credentials.acceptLanguage ?? "en,es;q=0.9,en-US;q=0.8,pt-BR;q=0.7,pt;q=0.6",
    );
    headers.set("Cache-Control", "no-cache");
    headers.set("Pragma", "no-cache");
    headers.set("Priority", "u=1, i");
    headers.set("Sec-Fetch-Dest", "empty");
    headers.set("Sec-Fetch-Mode", "cors");
    headers.set("Sec-Fetch-Site", "same-origin");
    headers.set("User-Agent", this.credentials.userAgent ?? "");
    headers.set("X-Requested-With", "XMLHttpRequest");
    headers.set("Origin", baseUrl);

    const cookieHeader = this.cookieStore.toHeader();

    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }

    const xsrfToken = this.credentials.xsrfToken || this.cookieStore.xsrfToken();
    if (xsrfToken) {
      headers.set("X-XSRF-TOKEN", xsrfToken);
    }

    if (this.credentials.sendCsrfToken && this.credentials.csrfToken) {
      headers.set("X-CSRF-TOKEN", this.credentials.csrfToken);
    }

    if (init.referer) {
      headers.set("Referer", this.normalizeReferer(init.referer));
    }

    return fetch(new URL(path, this.credentials.baseUrl), {
      ...init,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
  }

  private async bootstrapLoginPage() {
    const response = await this.fetchWithRedirectChain("/login", {
      method: "GET",
      cache: "no-store",
      headers: {
        Referer: this.absoluteUrl("/login"),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":
          this.credentials.acceptLanguage ?? "en,es;q=0.9,en-US;q=0.8,pt-BR;q=0.7,pt;q=0.6",
        "User-Agent": this.credentials.userAgent ?? "",
      },
      timeoutMs: 20_000,
    });

    if (!response.ok) {
      throw new Error(`Falha ao abrir /login no Softdesk: ${response.status}`);
    }
  }

  private async login() {
    const headers = new Headers({
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      "Accept-Language":
        this.credentials.acceptLanguage ?? "en,es;q=0.9,en-US;q=0.8,pt-BR;q=0.7,pt;q=0.6",
      Origin: this.credentials.baseUrl ?? "",
      Priority: "u=1, i",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": this.credentials.userAgent ?? "",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${this.credentials.baseUrl}/login?_redirect=%2Fchamado`,
    });

    const xsrfToken = this.credentials.xsrfToken || this.cookieStore.xsrfToken();
    if (xsrfToken) {
      headers.set("X-XSRF-TOKEN", xsrfToken);
    }

    if (this.credentials.sendCsrfToken && this.credentials.csrfToken) {
      headers.set("X-CSRF-TOKEN", this.credentials.csrfToken);
    }

    const cookieHeader = this.cookieStore.toHeader();
    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }

    const response = await fetch(new URL("/login", this.credentials.baseUrl), {
      method: "POST",
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        lg_usuario: this.credentials.username,
        sh_usuario: this.credentials.password,
        tp_usuario: this.credentials.userType,
        resposta: "",
        redirect_by_url: this.credentials.loginRedirect,
      }),
    });

    this.captureSetCookie(response);

    const redirectLocation = response.headers.get("location");
    if (redirectLocation?.includes("/login")) {
      throw new Error(`Softdesk redirecionou o login para ${redirectLocation}.`);
    }

    if (!response.ok) {
      throw new Error(`Falha ao autenticar no Softdesk: ${response.status}`);
    }
  }

  private captureSetCookie(response: Response) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) {
      this.cookieStore.mergeSetCookie(setCookies);
    }
  }

  private normalizeReferer(referer: string) {
    return /^https?:\/\//i.test(referer) ? referer : this.absoluteUrl(referer);
  }

  private async fetchWithRedirectChain(path: string, init: RequestOptions) {
    let currentUrl = this.absoluteUrl(path);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const headers = new Headers(init.headers);
      const cookieHeader = this.cookieStore.toHeader();
      if (cookieHeader) {
        headers.set("Cookie", cookieHeader);
      }

      const response = await fetch(currentUrl, {
        ...init,
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
      });

      this.captureSetCookie(response);

      const location = response.headers.get("location");
      if (!location || response.status < 300 || response.status >= 400) {
        return response;
      }

      currentUrl = new URL(location, currentUrl).toString();
    }

    throw new Error("Cadeia de redirect do /login excedeu o limite esperado.");
  }

  private shouldRetryWithLogin(response: Response) {
    if (response.status === 401 || response.status === 419) {
      return true;
    }

    if (response.status < 300 || response.status >= 400) {
      return false;
    }

    const location = response.headers.get("location") ?? "";
    return location.includes("/login");
  }
}
