import { StripeEnv } from "./StripeTypes.js";

export const getStripeEnv = (
  env: Record<string, string | undefined> = process.env
) =>
  StripeEnv.parse({
    secretKey: env.STRIPE_SECRET_KEY,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    webhookUrl: env.STRIPE_WEBHOOK_URL,
    successUrl: env.STRIPE_SUCCESS_URL,
    cancelUrl: env.STRIPE_CANCEL_URL,
    merchantDisplayName: env.STRIPE_MERCHANT_DISPLAY_NAME,
  });
