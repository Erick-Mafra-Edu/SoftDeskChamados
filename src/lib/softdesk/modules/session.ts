import { SoftdeskModule } from "@/lib/softdesk/modules/base";

export class SoftdeskSessionModule extends SoftdeskModule {
  snapshot() {
    return this.session.snapshot();
  }

  async ensureAuthenticated() {
    await this.session.ensureAuthenticated();
    return this.session.snapshot();
  }
}
