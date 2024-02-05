import express from "express";
import Stripe from "stripe";
import { destroyWebhooks } from "./destroyWebhooks.js";
import { DeepPartial } from "./DeepPartial.js";
import { deepFilter } from "./deepFilter.js";
import { waitFor } from "./waitFor.js";
import { makeNgrokListener } from "./ngrok.js";
import { makeStripeWebhook } from "./makeStripeWebhook.js";

export const makeTestStripeWebhook = async (
  stripe: Stripe,
  enabled_events: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = ["*"],
  port = 4050 + ((Math.random() * 900) | 0)
) => {
  let events: Stripe.Event[] = [];

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

  const close = async () => {
    await webhook.close();
    await server.close();
    await ngrok.close();
  };
  const clear = () => {
    events = [];
  };

  const ngrok = await makeNgrokListener(port);

  await destroyWebhooks(stripe, "test");
  const webhook = await makeStripeWebhook(
    stripe,
    "test",
    ngrok.url + "/stripe/webhook",
    async (event) => {
      events.push(event);
    },
    enabled_events
  );

  const app = express();
  app.use("/stripe/webhook", webhook.router);
  const server = app.listen(port, () => {});

  return { listen, filter, clear, close };
};

export type TestStripeWebhook = Awaited<
  ReturnType<typeof makeTestStripeWebhook>
>;
