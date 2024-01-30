import { before, afterEach, after, describe, it } from "node:test";
import { expect } from "expect";
import { StripePay } from "./StripePay.js";
import { StripeEnv } from "./StripeTypes.js";
import { getStripeEnv } from "./env.js";
import { z } from "zod";
import { makeEmailAlias } from "../utils/makeId.js";
import { makeStripeWebhook } from "../utils/makeStripeWebhook.js";
import { Plan, User } from "../Pay.js";
import "../utils/toBeWithinRange.js";
import {
  getSecondsFromDate,
  getSecondsFromDays,
} from "../utils/getSecondsFromDate.js";
import { Page, chromium } from "playwright";

const infiniteTestCard = "4242 4242 4242 4242";
const emptyTestCard = "4000000000000341";

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const context = await browser.newContext();
const page = await context.newPage();

const testConfig = z
  .object({
    STRIPE_TEST_PLAN_ID: z.string(),
    TEST_EMAIL: z.string().default("test_John@example.com"),
  })
  .parse(process.env);
const planId = testConfig.STRIPE_TEST_PLAN_ID;
const testEmail = testConfig.TEST_EMAIL;

let stripeEnv: StripeEnv;
let stripePay: StripePay;
let hook: Awaited<ReturnType<typeof makeStripeWebhook>>;
let testClock: string;

describe("StripePlan", () => {
  before(async () => {
    stripeEnv = getStripeEnv(process.env);
    stripePay = new StripePay(stripeEnv);
    testClock = await stripePay.createTime();
    hook = await makeStripeWebhook(stripePay.stripe);
  });
  afterEach(() => hook.clear());
  after(async () => {
    if (!stripePay) return;
    if (testClock) await stripePay.destroyTime(testClock);
    if (hook) await hook.close();
    await page.close();
    await context.close();
    await browser.close();
  });

  it("testStripePlanCancel", async () => {
    await withCustomer(async (customer: User) => {
      const plan = Plan.parse({
        id: planId,
        name: "testPlan",
        price: 1000,
        term: "month",
      });
      await signupSubscriptionInPortal(customer, plan, page);
      await expectSubscriptionUpdated(customer);
      await cancelSubscriptionInPortal(customer, page);
      await expectSubscriptionUpdatedCancelRequest(customer);
      await advanceClock(testClock);
      await expectSubscriptionDeleted(customer);
    });
  });
  it("testStripePlanChange", async () => {});
  it("testStripePlanPaymentFail", async () => {});
});

async function withCustomer(f: (customer: User) => Promise<void>) {
  const user = {
    firstName: "test_John",
    lastName: "test_Doe",
    email: makeEmailAlias(testEmail),
    phone: "555-555-7890",
  };
  const customer = await stripePay.createCustomer(user, testClock);
  try {
    expect(customer).toEqual(expect.objectContaining(user));
    expect(customer.customerId).toEqual(expect.any(String));
    await expect(hook.listen("customer.created")).resolves.toMatchObject({
      type: "customer.created",
      data: { object: { email: user.email } },
    });
    await f(customer);
  } finally {
    await stripePay.destroyCustomer(customer);
    await expect(hook.listen("customer.deleted")).resolves.toMatchObject({
      type: "customer.deleted",
      data: { object: { email: user.email } },
    });
  }
}

async function advanceClock(timeId: string, days: number = 32) {
  await stripePay.advanceTime(
    timeId,
    getSecondsFromDate() + getSecondsFromDays(days)
  );
}

async function signupSubscriptionInPortal(
  customer: User,
  plan: Plan,
  page: Page
) {
  const url = z.string().parse(
    await stripePay.getPlanUrl(customer.customerId, plan, {
      successUrl: "http://localhost",
    })
  );
  expect(url).toMatch("https://checkout.stripe.com/c/pay/");
  console.log("Visit this page:", url);
  console.log(
    "Test payments:",
    "https://stripe.com/docs/billing/subscriptions/build-subscriptions?ui=stripe-hosted#test-payment-methods"
  );

  await page.goto(url);
  await page.getByPlaceholder("1234 1234 1234").click();
  await page.getByPlaceholder("1234 1234 1234").fill(infiniteTestCard);
  await page.getByPlaceholder("MM / YY").click();
  await page.getByPlaceholder("MM / YY").fill("01 / 25");
  await page.getByPlaceholder("CVC").click();
  await page.getByPlaceholder("CVC").fill("123");
  await page.getByPlaceholder("MM / YY").click();
  await page.getByPlaceholder("Full name on card").click();
  await page.getByPlaceholder("Full name on card").fill("test");
  await page.getByTestId("hosted-payment-submit-button").click();
}

async function expectSubscriptionUpdatedCancelRequest(customer: User) {
  await expect(
    hook.listen("customer.subscription.updated", {
      cancel_at_period_end: true,
      status: "active",
    })
  ).resolves.toMatchObject({
    type: "customer.subscription.updated",
    data: {
      object: {
        customer: customer.customerId,
        current_period_end: expect.any(Number),
        current_period_start: expect.any(Number),
        status: "active",
        cancellation_details: {
          reason: "cancellation_requested",
        },
        cancel_at: expect.any(Number),
        cancel_at_period_end: true,
        items: {
          object: "list",
          data: [
            {
              object: "subscription_item",
              plan: {
                id: planId,
              },
            },
          ],
        },
      },
    },
  });
}

async function cancelSubscriptionInPortal(customer: User, page: Page) {
  const portalUrl = z
    .string()
    .parse(
      await stripePay.getPortalUrl(customer.customerId, "http://localhost")
    );
  console.log("Visit this page and cancel with feedback:", portalUrl);

  await page.goto(portalUrl);
  await page.locator('[data-test="cancel-subscription"]').click();
  await page.getByTestId("confirm").click();
  await page
    .locator('[data-test="cancel-reason-opt-missing_features"]')
    .check();
  await page.getByTestId("cancellation_reason_submit").click();
}

async function expectSubscriptionUpdated(customer: User) {
  await expect(
    hook.listen("customer.subscription.updated")
  ).resolves.toMatchObject({
    type: "customer.subscription.updated",
    data: {
      object: {
        customer: customer.customerId,
        start_date: expect.any(Number),
        current_period_end: expect.any(Number),
        current_period_start: expect.any(Number),
        status: "active",
        items: {
          object: "list",
          data: [
            {
              object: "subscription_item",
              plan: {
                id: planId,
              },
            },
          ],
        },
      },
    },
  });
}

async function expectSubscriptionDeleted(customer: User) {
  await expect(
    hook.listen("customer.subscription.deleted", {
      customer: customer.customerId,
      status: "canceled",
    })
  ).resolves.toMatchObject({
    type: "customer.subscription.deleted",
    data: {
      object: {
        customer: customer.customerId,
        current_period_start: expect.toBeWithinRange(
          getSecondsFromDate() + getSecondsFromDays(-1),
          getSecondsFromDate() + getSecondsFromDays(1)
        ),
        current_period_end: expect.toBeWithinRange(
          getSecondsFromDate() + getSecondsFromDays(27),
          getSecondsFromDate() + getSecondsFromDays(32)
        ),
        status: "canceled",
        cancellation_details: {
          reason: "cancellation_requested",
        },
        cancel_at: expect.any(Number),
        cancel_at_period_end: true,
        items: {
          object: "list",
          data: [
            {
              object: "subscription_item",
              plan: {
                id: planId,
              },
            },
          ],
        },
      },
    },
  });
}
