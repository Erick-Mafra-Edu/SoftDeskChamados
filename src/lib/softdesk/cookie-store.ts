import { unescape } from "node:querystring";

type CookieEntry = {
  name: string;
  value: string;
};

export class SoftdeskCookieStore {
  private readonly cookies = new Map<string, string>();

  constructor(seed?: string) {
    if (seed) {
      this.mergeCookieHeader(seed);
    }
  }

  mergeSetCookie(headers: string[]) {
    headers.forEach((header) => {
      const [pair] = header.split(";");
      const separatorIndex = pair.indexOf("=");

      if (separatorIndex < 0) {
        return;
      }

      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      this.cookies.set(name, value);
    });
  }

  mergeCookieHeader(header: string) {
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const separatorIndex = part.indexOf("=");

        if (separatorIndex < 0) {
          return;
        }

        const name = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        this.cookies.set(name, value);
      });
  }

  toHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  xsrfToken() {
    const token = this.cookies.get("XSRF-TOKEN");
    return token ? decodeCookieToken(token) : undefined;
  }

  list(): CookieEntry[] {
    return Array.from(this.cookies.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }

  clear() {
    this.cookies.clear();
  }
}

function decodeCookieToken(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return unescape(value);
  }
}
