// Copyright DWJ 2023.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import {
  PayfastContext,
  PayfastEnv,
  PayfastEvent,
  PayfastIntent,
} from "./PayfastTypes.js";

import { Pay, PayEvent, User } from "../Pay.js";
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
  ) {
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
    payload: string | Buffer,
    headers: Record<string, string | string[]>
  ): Promise<PayEvent> {
    await validatePayfast(payload, headers, this.config);
    const event = PayfastEvent.partial().parse(JSON.parse(payload.toString()));
    if (!event.m_payment_id) throw new Error("verifyEventPayfastPayE1");

    return {
      paymentId: event.m_payment_id,
      status: event.payment_status === "COMPLETE" ? "COMPLETE" : undefined,
      type: event.payment_status,
      data: JSON.stringify(event),
    };
  }
}
