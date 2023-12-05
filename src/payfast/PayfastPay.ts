// Copyright DWJ 2023.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import {
  PayfastContext,
  PayfastEnv,
  PayfastEvent,
  PayfastIntent,
} from "./PayfastTypes.js";

import { Pay, PayEvent, PayIntent, User } from "../Pay.js";
import {
  getParamString,
  getSignature,
  getSignedParamString,
  validatePayfast,
} from "./utils.js";
import { randId } from "../utils/randId.js";
import { objSnakeCase } from "../utils/case.js";

export class PayfastPay implements Pay {
  public config: PayfastEnv;

  constructor(config: PayfastEnv) {
    this.config = PayfastEnv.parse(config);
  }

  async getContext(): Promise<PayfastContext> {
    const { host, buyUrl, returnUrl, cancelUrl } = this.config;
    const payfastUrl = `https://${host}/eng/process`;
    return { payfastUrl, buyUrl, successUrl: returnUrl, cancelUrl };
  }

  async createIntent(
    user: User,
    item: string,
    amount: number,
    currency: string
  ): Promise<PayIntent> {
    const paymentId = "pf_" + randId(11);
    const data = await this.getOnceoffForm(user, paymentId, amount, item);

    return {
      paymentId: data.m_payment_id,
      customerId: user.customerId,
      amount,
      currency,
      data: JSON.stringify(data),
    };
  }

  async getOnceoffForm(
    user: User,
    paymentId: string,
    amount: number,
    item: string
  ): Promise<PayfastIntent> {
    const {
      merchantId,
      merchantKey,
      passPhrase,
      returnUrl,
      cancelUrl,
      notifyUrl,
    } = this.config;

    const data = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl + "?ref=" + paymentId,
      cancel_url: cancelUrl + "?ref=" + paymentId,
      notify_url: notifyUrl,
      name_first: user.firstName,
      name_last: user.lastName,
      email_address: user.email,
      m_payment_id: paymentId,
      amount: (amount / 100).toFixed(2),
      item_name: item,
    };

    const paramString = getParamString(objSnakeCase(data));
    const signature = getSignature(paramString, passPhrase);
    const signedParamString = getSignedParamString(paramString, signature);

    return PayfastIntent.parse({
      ...data,
      signature,
      paramString: signedParamString,
    });
  }

  async createCustomer(user: Omit<User, "customerId">): Promise<User> {
    const customerId = "cus_" + randId(11);
    return {
      ...user,
      customerId,
    };
  }

  async destroyCustomer(user: User): Promise<void> {}

  async verifyEvent(
    body: object,
    rawBody: string | Buffer,
    headers: Record<string, string | string[]>
  ): Promise<PayEvent> {
    const event = await validatePayfast(body, headers, this.config);
    if (!event.m_payment_id) throw new Error("verifyEventPayfastPayE1");

    return {
      paymentId: event.m_payment_id,
      status: event.payment_status === "COMPLETE" ? "COMPLETE" : undefined,
      type: event.payment_status,
      data: JSON.stringify(event),
    };
  }

  async createEvent(
    intent: PayIntent,
    status: "COMPLETE" | "CANCELLED" = "COMPLETE"
  ): Promise<{
    body: PayfastEvent;
    rawBody: string | Buffer;
    headers: Record<string, string | string[]>;
  }> {
    const fee = 5;
    const data = PayfastIntent.parse(JSON.parse(intent.data));

    const body: PayfastEvent = {
      m_payment_id: intent.paymentId,
      pf_payment_id: "pf_" + randId(11),
      payment_status: status,
      item_name: data.item_name,
      item_description: data.item_description ?? "",
      amount_gross: (+data.amount).toFixed(2),
      amount_fee: fee.toFixed(2),
      amount_net: (+data.amount - fee).toFixed(2),
      custom_str1: data.custom_str1,
      custom_str2: data.custom_str2,
      custom_str3: data.custom_str3,
      custom_str4: data.custom_str4,
      custom_str5: data.custom_str5,
      custom_int1: data.custom_int1?.toString(),
      custom_int2: data.custom_int2?.toString(),
      custom_int3: data.custom_int3?.toString(),
      custom_int4: data.custom_int4?.toString(),
      custom_int5: data.custom_int5?.toString(),
      name_first: data.name_first,
      name_last: data.name_last,
      email_address: data.email_address,
      merchant_id: data.merchant_id,
      signature: "",
    };
    body["signature"] = getSignature(
      getParamString(body),
      this.config.passPhrase
    );
    const headers = { "x-forwarded-for": "127.0.0.1" };

    return { body, headers, rawBody: JSON.stringify(body) };
  }
}
