import express from "express";
import Router from "express-promise-router";
import Stripe from "stripe";

export const makeStripeWebhook = async (
  stripe: Stripe,
  description: string,
  url: string,
  onEvent = async (event: Stripe.Event) => {},
  enabled_events: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = ["*"]
) => {
  const webhookEndpoint = await stripe.webhookEndpoints.create({
    description,
    enabled_events,
    url,
  });
  if (!webhookEndpoint.secret) throw new Error("secretE1");
  const router = makeStripeWebhookRouter(
    stripe,
    webhookEndpoint.secret,
    onEvent
  );
  const close = async () => {
    await stripe.webhookEndpoints.del(webhookEndpoint.id);
  };
  return { router, close };
};

export const makeStripeWebhookRouter = (
  stripe: Stripe,
  webhookSecret: string,
  onEvent = async (event: Stripe.Event) => {}
) => {
  const router = Router();
  router.use(
    express.json({
      verify: function (req, res, buf) {
        if (buf) req.raw = buf;
      },
    })
  );
  router.post("/", async (req, res) => {
    if (!req.raw) throw new Error("makeStripeWebhookRouterE1");
    if (!webhookSecret) throw new Error("makeStripeWebhookRouterE2");

    const event = stripe.webhooks.constructEvent(
      req.raw,
      req.headers["stripe-signature"]!,
      webhookSecret
    );

    await onEvent(event);

    res.sendStatus(200);
  });
  return router;
};
