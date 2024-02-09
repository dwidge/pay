import { before, after, describe, it } from "node:test";
import { expect } from "expect";
import { StripePay } from "./StripePay.js";
import { StripeEnv } from "./StripeTypes.js";
import { getStripeEnv } from "./env.js";
import { z } from "zod";
import { makeEmailAlias } from "../utils/makeId.js";
import {
  TestStripeWebhook,
  makeTestStripeWebhook,
} from "../utils/makeTestStripeWebhook.js";
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

const browser = await chromium.launch({
  headless: false,
  slowMo: 50,
});
const context = await browser.newContext({
  viewport: { width: 600, height: 400 },
});
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
export let hook: TestStripeWebhook;
let testPlan: Plan;
let testPlan2: Plan;

describe("StripePlan", async () => {
  await before(async () => {
    stripeEnv = getStripeEnv(process.env);
    stripePay = new StripePay(stripeEnv);
    hook = await makeTestStripeWebhook(stripeEnv);
    testPlan = await stripePay.getPlan(testConfig.STRIPE_TEST_PLAN1_ID);
    testPlan2 = await stripePay.getPlan(testConfig.STRIPE_TEST_PLAN2_ID);
  });
  await after(async () => {
    if (!stripePay) return;
    if (hook) await hook.close();
    await page.close();
    await context.close();
    await browser.close();
  });

  await it("testStripePlanSubCancel", async () => {
    await withCustomer(async (customer: User) => {
      const url = await stripePay.getPlanUrl({
        customerId: customer.customerId,
        planId: testPlan.id,
        successUrl: "http://localhost",
      });
      expect(url).toMatch("https://checkout.stripe.com/c/pay/");
      await signupSubscriptionInPortal(page, url, infiniteTestCard);
      await expectSubscriptionUpdated(hook, customer, testPlan.id, "active");
      const portalUrl = z.string().parse(
        await stripePay.getPortalUrl(customer.customerId, {
          returnUrl: "http://localhost",
        })
      );
      await cancelSubscriptionInPortal(page, portalUrl);
      await expectSubscriptionUpdatedCancelRequest(hook, customer, testPlan.id);
      await advanceClock(customer.customerId);
      await expectSubscriptionDeleted(hook, customer, testPlan.id);
    });
  });

  await it("testStripePlanSubChange", async () => {
    await withCustomer(async (customer: User) => {
      const url = await stripePay.getPlanUrl({
        customerId: customer.customerId,
        planId: testPlan.id,
        successUrl: "http://localhost",
      });
      await signupSubscriptionInPortal(page, url, infiniteTestCard);
      await expectSubscriptionUpdated(hook, customer, testPlan.id, "active");
      const portalUrl = z.string().parse(
        await stripePay.getPortalUrl(customer.customerId, {
          returnUrl: "http://localhost",
        })
      );
      await changeSubscriptionInPortal(page, portalUrl, testPlan2.name);
      await expectSubscriptionUpdated(hook, customer, testPlan2.id, "active");
    });
  });

  await it("testStripePlanSubPaymentFail", async () =>
    withCustomer(async (customer: User) => {
      const url = await stripePay.getPlanUrl({
        customerId: customer.customerId,
        planId: testPlan.id,
        successUrl: "http://localhost",
      });
      await signupSubscriptionInPortal(page, url, emptyTestCard);
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
      await advanceClock(customer.customerId);
      await expect(
        expectSubscriptionEvent(
          hook,
          "customer.subscription.updated",
          customer,
          testPlan.id,
          "active"
        )
      ).rejects.toThrow();
    }));

  await it("testStripePlanCreate", async () =>
    withCustomer(async (customer: User) => {
      const plan = await stripePay.createPlan({
        name: "test_testStripePlanCreate",
        price: 1000,
        currency: "usd",
        interval: "month",
      });
      const url = await stripePay.getPlanUrl({
        customerId: customer.customerId,
        planId: plan.id,
        successUrl: "http://localhost",
      });
      await signupSubscriptionInPortal(page, url, infiniteTestCard);
      await expectSubscriptionEvent(
        hook,
        "customer.subscription.updated",
        customer,
        plan.id,
        "active"
      );
      await stripePay.destroyPlan(plan.id);
      await expect(
        stripePay.getPlanUrl({
          customerId: customer.customerId,
          planId: plan.id,
          successUrl: "http://localhost",
        })
      ).rejects.toThrowError(
        "The price specified is inactive. This field only accepts active prices."
      );
    }));
});

async function withCustomer(f: (customer: User) => Promise<void>) {
  const user = {
    firstName: "test_John",
    lastName: "test_Doe",
    email: makeEmailAlias(testEmail),
    phone: "555-555-7890",
  };
  const customer = await stripePay.createCustomer(user);
  try {
    expect(customer).toEqual(expect.objectContaining(user));
    expect(customer.customerId).toEqual(expect.any(String));
    await hook.listen({
      type: "customer.created",
      data: { object: { email: user.email } },
    });
    await f(customer);
  } finally {
    await stripePay.destroyCustomer(customer.customerId);
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

async function advanceClock(customerId: string, days: number = 32) {
  const timeId = await stripePay.advanceCustomerTime(
    customerId,
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
