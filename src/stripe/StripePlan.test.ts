import { before, after, describe, it } from "node:test";
import { expect } from "expect";
import { StripePay } from "./StripePay.js";
import { StripeEnv } from "./StripeTypes.js";
import { getStripeEnv } from "./env.js";
import { z } from "zod";
import { makeEmailAlias } from "../utils/makeId.js";
import {
  StripeWebhook,
  makeStripeWebhook,
} from "../utils/makeStripeWebhook.js";
import { Plan, User } from "../Pay.js";
import "../utils/toBeWithinRange.js";
import {
  getSecondsFromDate,
  getSecondsFromDays,
} from "../utils/getSecondsFromDate.js";
import { chromium } from "playwright";
import {
  signupSubscriptionInPortal,
  cancelSubscriptionInPortal,
  changeSubscriptionInPortal,
} from "./customerPortalActions.js";
import {
  expectSubscriptionUpdated,
  expectSubscriptionUpdatedCancelRequest,
  expectSubscriptionDeleted,
  expectSubscriptionEvent,
} from "./expectEvent.js";

const infiniteTestCard = "4242 4242 4242 4242";
const emptyTestCard = "4000000000000341";

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const context = await browser.newContext();
const page = await context.newPage();

const testConfig = z
  .object({
    TEST_EMAIL: z.string().default("test_John@example.com"),
    STRIPE_TEST_PLAN1_ID: z.string(),
    STRIPE_TEST_PLAN2_ID: z.string(),
  })
  .parse(process.env);
const testEmail = testConfig.TEST_EMAIL;

let stripeEnv: StripeEnv;
export let stripePay: StripePay;
export let hook: StripeWebhook;
let testPlan: Plan;
let testPlan2: Plan;

describe("StripePlan", () => {
  before(async () => {
    stripeEnv = getStripeEnv(process.env);
    stripePay = new StripePay(stripeEnv);
    hook = await makeStripeWebhook(stripePay.stripe);
    testPlan = await stripePay.getPlan(testConfig.STRIPE_TEST_PLAN1_ID);
    testPlan2 = await stripePay.getPlan(testConfig.STRIPE_TEST_PLAN2_ID);
  });
  after(async () => {
    if (!stripePay) return;
    if (hook) await hook.close();
    await page.close();
    await context.close();
    await browser.close();
  });

  it("testStripePlanSubCancel", async () => {
    await withTime(async (timeId) => {
      await withCustomer({ timeId }, async (customer: User) => {
        await signupSubscriptionInPortal(
          stripePay,
          customer,
          testPlan,
          page,
          infiniteTestCard
        );
        await expectSubscriptionUpdated(hook, customer, testPlan.id, "active");
        await cancelSubscriptionInPortal(stripePay, customer, page);
        await expectSubscriptionUpdatedCancelRequest(
          hook,
          customer,
          testPlan.id
        );
        await advanceClock(timeId);
        await expectSubscriptionDeleted(hook, customer, testPlan.id);
      });
    });
  });
  it("testStripePlanSubPaymentFail", async () =>
    withTime(async (timeId) =>
      withCustomer({ timeId }, async (customer: User) => {
        await signupSubscriptionInPortal(
          stripePay,
          customer,
          testPlan,
          page,
          emptyTestCard
        );
        await hook.listen({
          type: "invoice.updated",
        });
        await expect(
          expectSubscriptionEvent(
            hook,
            "customer.subscription.created",
            customer,
            testPlan.id,
            "incomplete"
          )
        );
        await advanceClock(timeId);
        await expect(
          expectSubscriptionEvent(
            hook,
            "customer.subscription.updated",
            customer,
            testPlan.id,
            "active"
          )
        ).rejects.toThrow();
      })
    ));
  it("testStripePlanCreate", async () =>
    withTime(async (timeId) =>
      withCustomer({ timeId }, async (customer: User) => {
        const plan = await stripePay.createPlan({
          name: "test_testStripePlanCreate",
          price: 1000,
          currency: "usd",
          interval: "month",
        });
        await signupSubscriptionInPortal(
          stripePay,
          customer,
          plan,
          page,
          infiniteTestCard
        );
        await expectSubscriptionEvent(
          hook,
          "customer.subscription.updated",
          customer,
          plan.id,
          "active"
        );
        await stripePay.destroyPlan(plan.id);
        await expect(
          signupSubscriptionInPortal(
            stripePay,
            customer,
            plan,
            page,
            infiniteTestCard
          )
        ).rejects.toThrowError(
          "The price specified is inactive. This field only accepts active prices."
        );
      })
    ));
});

async function withCustomer(
  { timeId }: { timeId?: string },
  f: (customer: User) => Promise<void>
) {
  const user = {
    firstName: "test_John",
    lastName: "test_Doe",
    email: makeEmailAlias(testEmail),
    phone: "555-555-7890",
  };
  const customer = await stripePay.createCustomer(user, timeId);
  try {
    expect(customer).toEqual(expect.objectContaining(user));
    expect(customer.customerId).toEqual(expect.any(String));
    await expect(
      hook.listen({
        type: "customer.created",
        data: { object: { email: user.email } },
      })
    ).resolves.toMatchObject({
      type: "customer.created",
      data: { object: { email: user.email } },
    });
    await f(customer);
  } finally {
    await stripePay.destroyCustomer(customer);
    await hook.listen({
      type: "customer.deleted",
      data: { object: { email: user.email } },
    });
  }
}

async function withTime(f = async (timeId: string) => {}) {
  const timeId = await stripePay.createTime();
  return await f(timeId).finally(() => stripePay.destroyTime(timeId));
}

async function advanceClock(timeId: string, days: number = 32) {
  await stripePay.advanceTime(
    timeId,
    getSecondsFromDate() + getSecondsFromDays(days)
  );
  await hook.listen({
    type: "test_helpers.test_clock.ready",
    data: {
      object: {
        id: timeId,
      },
    },
  });
}
