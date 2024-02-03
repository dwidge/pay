import express from "express";
import Stripe from "stripe";
import ngrok from "@ngrok/ngrok";
import { destroyWebhooks } from "./destroyWebhooks.js";
import { DeepPartial } from "./DeepPartial.js";
import { deepFilter } from "./deepFilter.js";
import { waitFor } from "./waitFor.js";

declare module "express" {
  interface Request {
    raw?: Buffer;
  }
}
declare module "http" {
  interface IncomingMessage {
    raw: Buffer;
  }
}

export const makeStripeWebhook = async (
  stripe: Stripe,
  enabled_events: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = ["*"],
  port = 4050 + ((Math.random() * 900) | 0)
) => {
  await destroyWebhooks(stripe, "test");
  let events: Stripe.Event[] = [];
  const app = express();
  app.use(
    express.json({
      verify: function (req, res, buf) {
        if (buf) req.raw = buf;
      },
    })
  );
  app.post("/stripe/webhook", async (req, res) => {
    try {
      if (!req.raw) throw new Error("webhookE1");
      if (!webhookEndpoint.secret) throw new Error("webhookE2");

      const event = stripe.webhooks.constructEvent(
        req.raw,
        req.headers["stripe-signature"]!,
        webhookEndpoint.secret
      );

      console.log("webhook1", event.type, event.data.object);
      events.push(event);

      res.sendStatus(200);
    } catch (e) {
      console.log("webhookE3", e);
      res.sendStatus(200);
    }
  });

  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  const filter = (mask: DeepPartial<Stripe.Event>) =>
    events.filter((v) => deepFilter(v, mask));

  // removes first match and returns it
  const listen = (
    mask: DeepPartial<Stripe.Event>,
    retries = 20,
    interval = 500
  ) =>
    waitFor(
      async () => {
        const [event] = filter(mask);
        if (!event) throw new Error("No event: " + JSON.stringify(mask));
        events.splice(events.indexOf(event), 1);
        return event;
      },
      retries,
      interval
    );

  const ngrokListener = await ngrok
    .forward({ addr: port, authtoken_from_env: true })
    .catch((e) => {
      console.log("ngrokE1", e.message);
      throw e;
    });
  const externalUrl = ngrokListener.url();
  // console.log("url1", externalUrl);

  const webhookEndpoint = await stripe.webhookEndpoints.create({
    description: "test",
    enabled_events,
    url: externalUrl + "/stripe/webhook",
  });
  if (!webhookEndpoint.secret) throw new Error("secretE1");
  // console.log("webhookEndpoint1", webhookEndpoint);

  const close = async () => {
    await stripe.webhookEndpoints.del(webhookEndpoint.id);
    server.close();
  };
  const clear = () => {
    events = [];
  };

  return { listen, filter, clear, close };
};

export type StripeWebhook = Awaited<ReturnType<typeof makeStripeWebhook>>;
