import express from "express";
import Stripe from "stripe";
import { DeepPartial } from "./DeepPartial.js";
import { deepFilter } from "./deepFilter.js";
import { waitFor } from "./waitFor.js";
import { makeNgrokListener } from "./ngrok.js";
import { StripeEnv } from "../stripe/StripeTypes.js";
import { StripeWebhook } from "../stripe/StripeWebhook.js";

export const makeTestStripeWebhook = async (
  stripeEnv: StripeEnv,
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
    interval = 1000
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

  const webhook = new StripeWebhook(
    stripeEnv,
    Promise.resolve(ngrok.url + "/stripe/webhook"),
    { description: "test", enabled_events }
  );

  const app = express();
  app.use(
    express.json({
      verify: function (req, res, buf) {
        if (buf) req.raw = buf;
      },
    })
  );
  app.post("/stripe/webhook", async (req, res) => {
    const event = await webhook.verifyStripeEvent(req);
    console.log("makeTestStripeWebhook1", event.type);
    events.push(event);
    res.sendStatus(200);
  });
  const server = app.listen(port, () => {});

  return { listen, filter, clear, close };
};

export type TestStripeWebhook = Awaited<
  ReturnType<typeof makeTestStripeWebhook>
>;
