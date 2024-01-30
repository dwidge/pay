import { z } from "zod";
import { currencyCodes } from "./utils/currencyCodes.js";

export const User = z.object({
  customerId: z.string(),
  firstName: z.string(),
  lastName: z.ostring(),
  email: z.string(),
  phone: z.ostring(),
});
export type User = z.infer<typeof User>;

export const PayContext = z.object({
  successUrl: z.string(),
  cancelUrl: z.string().optional(),
});
export type PayContext = z.infer<typeof PayContext>;

export const PayIntent = z.object({
  paymentId: z.string(),
  customerId: z.string(),
  amount: z.number(),
  currency: z.string(),
  data: z.string(),
});
export type PayIntent = z.infer<typeof PayIntent>;

export const PayEvent = z.object({
  paymentId: z.string(),
  status: z.enum(["PENDING", "COMPLETE", "CANCELLED"]).optional(),
  type: z.ostring(),
  data: z.ostring(),
});
export type PayEvent = z.infer<typeof PayEvent>;

export interface Pay {
  getContext(): Promise<PayContext>;
  createCustomer(user: Omit<User, "customerId">): Promise<User>;
  destroyCustomer(user: User): Promise<void>;
  createIntent(
    user: User,
    item: string,
    amount: number,
    currency: string
  ): Promise<PayIntent>;
  verifyEvent(
    body: object,
    rawBody: string | Buffer,
    headers: Record<string, string | string[]>
  ): Promise<PayEvent>;
}

export const Plan = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  currency: z.enum(currencyCodes),
  interval: z.enum(["month", "year"]),
});
export type Plan = z.infer<typeof Plan>;

export const UserPlan = z.object({
  userId: z.string(),
  customerId: z.string(),
  planId: z.string(),
  createDate: z.date(),
  payDate: z.date().optional(),
  expireDate: z.date().optional(),
});
export type UserPlan = z.infer<typeof UserPlan>;
