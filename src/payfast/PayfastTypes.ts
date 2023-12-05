// Copyright DWJ 2023.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import { z, object, string, ostring, number, onumber } from "zod";

export const PayfastEnv = object({
  merchantId: string(),
  merchantKey: string(),
  passPhrase: string(),
  buyUrl: string(),
  returnUrl: string(),
  cancelUrl: string(),
  notifyUrl: string(),
  host: string(),
  hookCheckAddress: z.boolean(),
  hookCheckServer: z.boolean(),
});
export type PayfastEnv = z.infer<typeof PayfastEnv>;

export const PayfastContext = object({
  payfastUrl: string(),
  buyUrl: string(),
  successUrl: string(),
  cancelUrl: string(),
});
export type PayfastContext = z.infer<typeof PayfastContext>;

export const PayfastIntent = object({
  merchant_id: string(),
  merchant_key: string(),
  return_url: ostring(),
  cancel_url: ostring(),
  notify_url: ostring(),
  name_first: string(),
  name_last: string(),
  email_address: string(),
  cell_number: ostring(),
  m_payment_id: string(),
  amount: string(),
  item_name: string(),
  item_description: ostring(),
  custom_int1: onumber(),
  custom_int2: onumber(),
  custom_int3: onumber(),
  custom_int4: onumber(),
  custom_int5: onumber(),
  custom_str1: ostring(),
  custom_str2: ostring(),
  custom_str3: ostring(),
  custom_str4: ostring(),
  custom_str5: ostring(),
  email_confirmation: onumber(),
  confirmation_address: ostring(),
  payment_method: ostring(),
  signature: string(),
  paramString: string(),
});
export type PayfastIntent = z.infer<typeof PayfastIntent>;

export const PayfastEvent = object({
  m_payment_id: string(),
  pf_payment_id: string(),
  payment_status: z.enum(["COMPLETE", "CANCELLED"]),
  item_name: string(),
  item_description: z.ostring(),
  amount_gross: string(),
  amount_fee: string(),
  amount_net: string(),
  custom_str1: ostring(),
  custom_str2: ostring(),
  custom_str3: ostring(),
  custom_str4: ostring(),
  custom_str5: ostring(),
  custom_int1: ostring(),
  custom_int2: ostring(),
  custom_int3: ostring(),
  custom_int4: ostring(),
  custom_int5: ostring(),
  name_first: string(),
  name_last: string(),
  email_address: string(),
  merchant_id: string(),
  token: ostring(),
  billing_date: ostring(),
  signature: string(),
});
export type PayfastEvent = z.infer<typeof PayfastEvent>;
