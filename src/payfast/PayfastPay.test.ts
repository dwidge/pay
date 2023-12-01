import { beforeEach, describe, it } from "node:test";
import { expect } from "expect";
import { PayfastPay } from "./PayfastPay.js";
import { getPayfastEnv } from "./env.js";
import { PayfastEnv, PayfastEvent, PayfastIntent } from "./PayfastTypes.js";
import { getParamString, getSignature } from "./utils.js";

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
    const user = {
      firstName: "test_John",
      lastName: "test_Doe",
      email: "test_john@example.com",
    };
    const item = "test_Product";
    const amount = 1000;
    const currency = "USD";

    const customer = await payfastPay.createCustomer(user);
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
    expect(PayfastIntent.parse(JSON.parse(intent.data))).toMatchObject({
      m_payment_id: expect.any(String),
      signature: expect.any(String),
    });

    await payfastPay.destroyCustomer(customer);
  });

  it("verifyEvent should return correct PayEvent", async () => {
    const payload: PayfastEvent = {
      m_payment_id: "pf_12345",
      pf_payment_id: "pf_167890",
      payment_status: "COMPLETE",
      item_name: "test_Product",
      item_description: "Description of example item",
      amount_gross: "100.00",
      amount_fee: "5.00",
      amount_net: "95.00",
      custom_str1: "Custom String 1",
      custom_str2: "Custom String 2",
      custom_str3: "Custom String 3",
      custom_str4: "Custom String 4",
      custom_str5: "Custom String 5",
      custom_int1: "1",
      custom_int2: "2",
      custom_int3: "3",
      custom_int4: "4",
      custom_int5: "5",
      name_first: "test_John",
      name_last: "test_Doe",
      email_address: "test_john@example.com",
      merchant_id: "789",
      signature: "",
    };
    payload["signature"] = getSignature(
      getParamString(payload),
      payfastEnv.passPhrase
    );

    const headers = { "x-forwarded-for": "127.0.0.1" };
    const payEvent = await payfastPay.verifyEvent(
      JSON.stringify(payload),
      headers
    );
    expect(payEvent).toEqual({
      paymentId: expect.any(String),
      status: "COMPLETE" || undefined,
      type: expect.any(String),
      data: expect.any(String),
    });
  });
});
