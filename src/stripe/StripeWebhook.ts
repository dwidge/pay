import Stripe from "stripe";
import { z } from "zod";
import { PayEvent, Req } from "../Pay.js";
import { StripeEnv } from "./StripeTypes.js";
import { destroyWebhooks } from "../utils/destroyWebhooks.js";

export class StripeWebhook {
  public stripe: Stripe;
  public webhookEndpoint: Promise<Stripe.WebhookEndpoint | undefined>;
  public webhookSecret: Promise<string | undefined>;

  constructor(
    config: Pick<StripeEnv, "secretKey" | "webhookSecret">,
    webhookUrl?: Promise<string>,
    {
      description = "test",
      enabled_events = ["*"],
    }: {
      description?: string;
      enabled_events?: Stripe.WebhookEndpointCreateParams.EnabledEvent[];
    } = {}
  ) {
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: "2023-10-16",
    });

    this.webhookEndpoint = webhookUrl
      ? webhookUrl.then(async (url) => {
          if (description) await destroyWebhooks(this.stripe, description);
          return this.stripe.webhookEndpoints.create({
            description,
            enabled_events,
            url,
          });
        })
      : Promise.resolve(undefined);
    this.webhookSecret = this.webhookEndpoint.then(
      (w) => w?.secret ?? config.webhookSecret
    );

    webhookUrl?.then((webhookUrl) => {
      console.log("webhookUrl1", { webhookUrl });
    });
    this.webhookEndpoint.then((webhookEndpoint) => {
      console.log("webhookEndpoint1", { webhookEndpoint });
    });
    this.webhookSecret.then((webhookSecret) => {
      console.log("webhookSecret1", { webhookSecret });
    });
  }
  async close() {
    await this.webhookEndpoint.then(
      (w) => w && this.stripe.webhookEndpoints.del(w.id)
    );
  }

  async verifyStripeEvent({ body, raw, headers }: Req): Promise<Stripe.Event> {
    const webhookSecret = await this.webhookSecret;
    if (!webhookSecret) return body as Stripe.Event;

    const signature = headers["stripe-signature"];
    if (!signature) throw new Error("constructEventE1", { cause: headers });
    return await this.stripe.webhooks
      .constructEventAsync(raw, signature, webhookSecret)
      .catch((cause) => {
        throw new Error("constructEventE2", { cause });
      });
  }

  async parseStripeEvent(event: Stripe.Event): Promise<PayEvent | undefined> {
    if (event.type === "payment_intent.succeeded") {
      const paymentId = z.string().parse(event.data.object.id);
      const status =
        event.type === "payment_intent.succeeded" ? "COMPLETE" : undefined;

      return {
        paymentId,
        status,
        type: event.type,
        data: JSON.stringify(event.data.object),
      };
    }
    if (event.type === "customer.subscription.created") {
      const customerId = event.data.object.customer.toString();
    }
    if (event.type === "customer.subscription.deleted") {
      const customerId = event.data.object.customer.toString();
    }
    if (event.type === "customer.subscription.updated") {
      const customerId = event.data.object.customer.toString();
      const subs = event.data.object.items.data.map((v) => v);
    }
  }

  async parseEvent(req: Req): Promise<PayEvent | undefined> {
    const event = await this.verifyStripeEvent(req);
    console.log("parseEvent1", event.type);
    return await this.parseStripeEvent(event);
  }
}
