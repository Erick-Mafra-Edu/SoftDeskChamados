import { SoftdeskSessionManager } from "@/lib/softdesk/session-manager";
import { SoftdeskChamadosModule } from "@/lib/softdesk/modules/chamados";
import { SoftdeskSessionModule } from "@/lib/softdesk/modules/session";

export class SoftdeskClient {
  readonly chamados: SoftdeskChamadosModule;
  readonly auth: SoftdeskSessionModule;

  constructor(readonly session: SoftdeskSessionManager) {
    this.chamados = new SoftdeskChamadosModule(session);
    this.auth = new SoftdeskSessionModule(session);
  }
}
