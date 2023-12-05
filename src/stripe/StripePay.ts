import Stripe from "stripe";
import { PayEvent, Pay, User } from "../Pay.js";
import { StripeContext, StripeEnv, StripeEvent } from "./StripeTypes.js";
import { z } from "zod";

export class StripePay implements Pay {
  public stripe: Stripe;
  public config: StripeEnv;

  constructor(config: StripeEnv) {
    this.config = StripeEnv.parse(config);
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: "2023-10-16",
    });
  }

  async getContext(): Promise<StripeContext> {
    const {
      publishableKey,
      urlScheme,
      merchantIdentifier,
      merchantDisplayName,
      successUrl,
      cancelUrl,
    } = this.config;
    return {
      publishableKey,
      urlScheme,
      merchantIdentifier,
      merchantDisplayName,
      successUrl,
      cancelUrl,
    };
  }

  async createIntent(
    user: User,
    item: string,
    amount: number,
    currency: string
  ) {
    const ephemeralKey = await this.stripe.ephemeralKeys
      .create(
        {
          customer: user.customerId,
        },
        {
          apiVersion: "2023-10-16",
        }
      )
      .catch((cause) => {
        throw new Error("createIntentStripePayE1", { cause });
      });

    const { id, client_secret, ...data } = await this.stripe.paymentIntents
      .create({
        amount,
        currency,
        customer: user.customerId,
        automatic_payment_methods: { enabled: true },
      })
      .catch((cause) => {
        throw new Error("createIntentStripePayE2", { cause });
      });

    if (!ephemeralKey.secret) throw new Error("createIntentStripePayE3");
    if (!client_secret) throw new Error("createIntentStripePayE4");

    return {
      paymentId: id,
      customerId: user.customerId,
      amount,
      currency,
      data: JSON.stringify({
        ...data,
        id,
        customerId: user.customerId,
        clientSecret: client_secret,
        ephemeralKey: ephemeralKey.secret,
      }),
    };
  }

  async createCustomer(user: Omit<User, "customerId">): Promise<User> {
    const { id: customerId } = await this.stripe.customers
      .create({
        email: user.email,
        phone: user.phone,
        name: user.firstName + " " + user.lastName ?? "",
      })
      .catch((cause) => {
        throw new Error("createCustomerStripePayE1", { cause });
      });
    return {
      ...user,
      customerId,
    };
  }

  async destroyCustomer(user: User): Promise<void> {
    await this.stripe.customers.del(user.customerId).catch((cause) => {
      throw new Error("destroyCustomerStripePayE1", { cause });
    });
  }

  async verifyStripeEvent(
    payload: string | Buffer,
    headers: Record<string, string | string[]>
  ): Promise<StripeEvent> {
    if (!this.config.webhookSecret)
      return StripeEvent.parse(JSON.parse(payload.toString()));

    try {
      return StripeEvent.parse(
        this.stripe.webhooks.constructEvent(
          payload,
          headers["stripe-signature"],
          this.config.webhookSecret
        )
      );
    } catch (cause) {
      throw new Error("verifyEventStripePayE1", { cause });
    }
  }

  async verifyEvent(
    body: object,
    rawBody: string | Buffer,
    headers: Record<string, string | string[]>
  ): Promise<PayEvent> {
    const event = await this.verifyStripeEvent(rawBody, headers);
    const data = event.data.object;
    const paymentId = z.string().parse(data.id);
    const status =
      event.type === "payment_intent.succeeded" ? "COMPLETE" : undefined;

    return {
      paymentId,
      status,
      type: event.type,
      data: JSON.stringify(data),
    };
  }
}
