import { beforeEach, describe, it } from "node:test";
import { expect } from "expect";
import { StripePay } from "./StripePay.js";
import { StripeContext, StripeEnv, StripeIntent } from "./StripeTypes.js";
import { getStripeEnv } from "./env.js";

describe("StripePay", () => {
  let stripeEnv: StripeEnv;
  let stripePay: StripePay;

  beforeEach(() => {
    stripeEnv = getStripeEnv(process.env);
    stripePay = new StripePay(stripeEnv);
  });

  it("initializes with the correct config", () => {
    expect(stripePay.config).toEqual(stripeEnv);
  });

  it("getContext returns the expected StripeContext", async () => {
    const expectedContext: StripeContext = {
      publishableKey: stripeEnv.publishableKey,
      urlScheme: stripeEnv.urlScheme,
      merchantIdentifier: stripeEnv.merchantIdentifier,
      merchantDisplayName: stripeEnv.merchantDisplayName,
      successUrl: stripeEnv.successUrl,
      cancelUrl: stripeEnv.cancelUrl,
    };
    const context = await stripePay.getContext();
    expect(context).toEqual(expectedContext);
  });

  it("createCustomer returns the expected User data", async () => {
    const user = {
      firstName: "test_John",
      lastName: "test_Doe",
      email: "test_john@example.com",
      phone: "555-555-7890",
    };
    const customer = await stripePay.createCustomer(user);

    expect(customer).toEqual(expect.objectContaining(user));
    expect(customer.customerId).toEqual(expect.any(String));

    await stripePay.destroyCustomer(customer);
  });

  it("createIntent returns the expected payment data", async () => {
    const user = {
      firstName: "test_John",
      lastName: "test_Doe",
      email: "test_john@example.com",
      phone: "555-555-7890",
    };
    const item = "test_Product";
    const amount = 1000;
    const currency = "USD";

    const customer = await stripePay.createCustomer(user);
    const intent = await stripePay.createIntent(
      customer,
      item,
      amount,
      currency
    );

    expect(intent).toEqual({
      paymentId: expect.any(String),
      customerId: customer.customerId,
      amount: amount,
      currency: currency,
      data: expect.any(String),
    });
    expect(StripeIntent.parse(JSON.parse(intent.data))).toMatchObject({
      id: expect.any(String),
      customerId: customer.customerId,
      clientSecret: expect.any(String),
      ephemeralKey: expect.any(String),
    });

    await stripePay.destroyCustomer(customer);
  });
});
