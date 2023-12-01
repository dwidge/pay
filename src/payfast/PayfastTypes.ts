// Copyright DWJ 2023.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import { z, string, object, number } from "zod";

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
  return_url: string().optional(),
  cancel_url: string().optional(),
  notify_url: string().optional(),
  name_first: string().optional(),
  name_last: string().optional(),
  email_address: string().optional(),
  cell_number: string().optional(),
  m_payment_id: string(),
  amount: string(),
  item_name: string(),
  item_description: string().optional(),
  custom_int1: number().optional(),
  custom_int2: number().optional(),
  custom_int3: number().optional(),
  custom_int4: number().optional(),
  custom_int5: number().optional(),
  custom_str1: string().optional(),
  custom_str2: string().optional(),
  custom_str3: string().optional(),
  custom_str4: string().optional(),
  custom_str5: string().optional(),
  email_confirmation: number().optional(),
  confirmation_address: string().optional(),
  payment_method: string().optional(),
  signature: string(),
  paramString: string(),
});
export type PayfastIntent = z.infer<typeof PayfastIntent>;

export const PayfastEvent = object({
  m_payment_id: string(),
  pf_payment_id: string(),
  payment_status: z.enum(["COMPLETE", "CANCELLED"]),
  item_name: string(),
  item_description: string(),
  amount_gross: string(),
  amount_fee: string(),
  amount_net: string(),
  custom_str1: string(),
  custom_str2: string(),
  custom_str3: string(),
  custom_str4: string(),
  custom_str5: string(),
  custom_int1: string(),
  custom_int2: string(),
  custom_int3: string(),
  custom_int4: string(),
  custom_int5: string(),
  name_first: string(),
  name_last: string(),
  email_address: string(),
  merchant_id: string(),
  token: string().optional(),
  billing_date: string().optional(),
  signature: string(),
});
export type PayfastEvent = z.infer<typeof PayfastEvent>;
