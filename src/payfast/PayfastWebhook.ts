import { PayfastEnv } from "./PayfastTypes.js";
import { PayEvent, Req } from "../Pay.js";
import { validatePayfast } from "./utils.js";

export class PayfastWebhook {
  public config: PayfastEnv;

  constructor(config: PayfastEnv) {
    this.config = config;
  }
  async close() {}

  async parseEvent(req: Req): Promise<PayEvent> {
    const event = await validatePayfast(req, this.config);
    if (!event.m_payment_id) throw new Error("verifyEventPayfastPayE1");

    return {
      paymentId: event.m_payment_id,
      status: event.payment_status === "COMPLETE" ? "COMPLETE" : undefined,
      type: event.payment_status,
      data: JSON.stringify(event),
    };
  }
}
