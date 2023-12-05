import { beforeEach, describe, it } from "node:test";
import { expect } from "expect";
import { PayfastPay } from "./PayfastPay.js";
import { getPayfastEnv } from "./env.js";
import { PayfastEnv, PayfastIntent } from "./PayfastTypes.js";

const testCustomer = {
  firstName: "test_John",
  lastName: "test_Doe",
  email: "test_john@example.com",
};

describe("PayfastPay", () => {
  let payfastEnv: PayfastEnv;
  let payfastPay: PayfastPay;

  beforeEach(() => {
    payfastEnv = getPayfastEnv(process.env);
    payfastPay = new PayfastPay(payfastEnv);
  });

  it("getContext should return correct PayfastContext", async () => {
    const context = await payfastPay.getContext();
    expect(context).toEqual({
      payfastUrl: `https://${payfastEnv.host}/eng/process`,
      buyUrl: payfastEnv.buyUrl,
      successUrl: payfastEnv.returnUrl,
      cancelUrl: payfastEnv.cancelUrl,
    });
  });

  it("createIntent should return correct PayfastIntent", async () => {
    const item = "test_Product";
    const amount = 1000;
    const currency = "USD";

    const customer = await payfastPay.createCustomer(testCustomer);
    const intent = await payfastPay.createIntent(
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
    expect(PayfastIntent.parse(JSON.parse(intent.data ?? "{}"))).toMatchObject({
      m_payment_id: expect.any(String),
      signature: expect.any(String),
    });

    await payfastPay.destroyCustomer(customer);
  });

  it("verifyEvent should return correct PayEvent", async () => {
    const customer = await payfastPay.createCustomer(testCustomer);
    const intent = await payfastPay.createIntent(
      customer,
      "test_Product",
      100,
      "zar"
    );
    const event = await payfastPay.createEvent(intent);

    const payEvent = await payfastPay.verifyEvent(
      event.body,
      event.rawBody,
      event.headers
    );
    expect(payEvent).toEqual({
      paymentId: expect.any(String),
      status: "COMPLETE" || undefined,
      type: expect.any(String),
      data: expect.any(String),
    });

    event.body["signature"] = "abc";

    await expect(
      payfastPay.verifyEvent(event.body, event.rawBody, event.headers)
    ).rejects.toThrow("validateE1");
  });
});
