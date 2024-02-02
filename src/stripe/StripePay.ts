import Stripe from "stripe";
import { z } from "zod";
import { PayEvent, Pay, User, Plan, UserPlan } from "../Pay.js";
import { StripeContext, StripeEnv, StripeEvent } from "./StripeTypes.js";
import { getSecondsFromDate } from "../utils/getSecondsFromDate.js";

type PayCallbacks = {
  getUserCustomerId?: (userId: string) => Promise<string>;
  setUserCustomerId?: (userId: string, customerId: string) => Promise<void>;
  updateUserPlan?: (userId: string, plan: UserPlan) => Promise<void>;
  userPlanActive: (userId: string, plans: Plan) => Promise<void>;
};

export class StripePay implements Pay {
  public stripe: Stripe;
  public config: StripeEnv;
  public callbacks?: PayCallbacks;

  constructor(config: StripeEnv, callbacks?: PayCallbacks) {
    this.config = StripeEnv.parse(config);
    this.callbacks = callbacks;
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

  async createCustomer(
    user: Omit<User, "customerId">,
    timeId?: string
  ): Promise<User> {
    const { id: customerId } = await this.stripe.customers
      .create({
        email: user.email,
        phone: user.phone,
        name: user.firstName + " " + (user.lastName ?? ""),
        test_clock: timeId,
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

  async createTime(time: number = getSecondsFromDate()): Promise<string> {
    return this.stripe.testHelpers.testClocks
      .create({
        frozen_time: time,
      })
      .then((testClock) => testClock.id);
  }
  async advanceTime(
    timeId: string,
    time: number = getSecondsFromDate()
  ): Promise<void> {
    await this.stripe.testHelpers.testClocks.advance(timeId, {
      frozen_time: time,
    });
  }
  async destroyTime(timeId: string): Promise<void> {
    await this.stripe.testHelpers.testClocks.del(timeId);
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
      // res.sendStatus(400);
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
  async handleStripeEvent(event: Stripe.Event) {
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

  async getPortalUrl(customerId: string, options?: { returnUrl?: string }) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: options?.returnUrl,
    });
    return session.url;
  }
  async getPlanUrl(options: {
    planId: string;
    customerId: string;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    const session = await this.stripe.checkout.sessions.create({
      customer: options.customerId,
      line_items: [
        {
          price: options.planId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: options?.successUrl,
      cancel_url: options?.cancelUrl,
    });

    if (!session.url) throw new Error("getPlanUrlE2");

    return session.url;
  }
  async somePlanActive(planIds: string[], customerId: string) {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
    });
    return subscriptions.data.some((s) => planIds.includes(s.id));
  }
  async createPlan(newPlan: Readonly<Omit<Plan, "id">>) {
    newPlan = Plan.omit({ id: true }).parse(newPlan);
    const plan = await this.stripe.prices.create({
      billing_scheme: "per_unit",
      unit_amount: newPlan.price,
      currency: newPlan.currency,
      recurring: {
        interval: newPlan.interval,
      },
      product_data: { name: newPlan.name },
    });
    return Plan.parse({ ...newPlan, id: plan.id });
  }
  async getPlan(planId: string) {
    const plan = await this.stripe.prices.retrieve(planId, {
      expand: ["product"],
    });
    return Plan.parse({
      id: plan.id,
      name: (plan.product as Stripe.Product).name,
      price: plan.unit_amount,
      currency: plan.currency,
      interval: plan.recurring?.interval,
    });
  }
  async destroyPlan(planId: string) {
    await this.stripe.prices.update(planId, { active: false });
  }
}
