import { SoftdeskSessionManager } from "@/lib/softdesk/session-manager";

export abstract class SoftdeskModule {
  constructor(protected readonly session: SoftdeskSessionManager) {}

  protected request(path: string, init?: Parameters<SoftdeskSessionManager["request"]>[1]) {
    return this.session.request(path, init);
  }
}
