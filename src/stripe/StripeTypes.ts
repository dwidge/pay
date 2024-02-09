// Copyright DWJ 2023.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import { z, string, object } from "zod";

export const StripeEnv = object({
  secretKey: string(),
  webhookSecret: z.ostring(),
  publishableKey: string(),
  urlScheme: string().optional(),
  merchantIdentifier: string().optional(),
  merchantDisplayName: string(),
  successUrl: string(),
  cancelUrl: string().optional(),
});
export type StripeEnv = z.infer<typeof StripeEnv>;

export const StripeContext = object({
  publishableKey: string(),
  urlScheme: string().optional(),
  merchantIdentifier: string().optional(),
  merchantDisplayName: string(),
  successUrl: string(),
  cancelUrl: string().optional(),
});
export type StripeContext = z.infer<typeof StripeContext>;

export const StripeIntent = object({
  id: string(),
  customerId: string(),
  clientSecret: string(),
  ephemeralKey: string(),
});
export type StripeIntent = z.infer<typeof StripeIntent>;

export const StripeEvent = object({
  type: string(),
  data: object({ object: z.any() }),
});
export type StripeEvent = z.infer<typeof StripeEvent>;
