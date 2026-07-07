import { loadSoftdeskConfig } from "@/lib/softdesk/config";
import { SoftdeskClient } from "@/lib/softdesk/client";
import { credentialsSchema, type SoftdeskCredentialsInput } from "@/lib/softdesk/schema";
import { SoftdeskSessionManager } from "@/lib/softdesk/session-manager";

class SoftdeskRegistry {
  private client?: SoftdeskClient;
  private session?: SoftdeskSessionManager;
  private configFingerprint?: string;

  isConfigured() {
    if (process.env.SOFTDESK_FORCE_MOCK === "true") {
      return false;
    }

    const config = loadSoftdeskConfig();
    return Boolean(config.baseUrl && config.username && config.password);
  }

  async connect(overrides?: SoftdeskCredentialsInput) {
    const config = credentialsSchema.parse({
      ...loadSoftdeskConfig(),
      ...overrides,
    });
    const fingerprint = JSON.stringify(config);

    if (!this.client || !this.session || this.configFingerprint !== fingerprint) {
      this.session = new SoftdeskSessionManager(config);
      this.client = new SoftdeskClient(this.session);
      this.configFingerprint = fingerprint;
    }

    await this.client.auth.ensureAuthenticated();
    return this.client;
  }

  getSnapshot() {
    return this.client?.auth.snapshot() ?? null;
  }
}

let registry: SoftdeskRegistry | undefined;

export function getSoftdeskRegistry() {
  registry ??= new SoftdeskRegistry();
  return registry;
}
