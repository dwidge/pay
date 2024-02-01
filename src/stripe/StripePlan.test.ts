import { before, after, describe, it } from "node:test";
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
    TEST_EMAIL: z.string().default("test_John@example.com"),
  })
  .parse(process.env);
const testEmail = testConfig.TEST_EMAIL;

let stripeEnv: StripeEnv;
let stripePay: StripePay;
let hook: Awaited<ReturnType<typeof makeStripeWebhook>>;
let testPlan: Plan;

describe("StripePlan", () => {
  before(async () => {
    stripeEnv = getStripeEnv(process.env);
    stripePay = new StripePay(stripeEnv);
    hook = await makeStripeWebhook(stripePay.stripe);
    testPlan = await stripePay.createPlan({
      name: "test_StripePlan",
      price: 1000,
      currency: "usd",
      interval: "month",
    });
  });
  after(async () => {
    if (!stripePay) return;
    if (testPlan) await stripePay.destroyPlan(testPlan.id);
    if (hook) await hook.close();
    await page.close();
    await context.close();
    await browser.close();
  });

  it("testStripePlanSubCancel", async () => {
    await withTime(async (timeId) => {
      await withCustomer({ timeId }, async (customer: User) => {
        await signupSubscriptionInPortal(
          customer,
          testPlan,
          page,
          infiniteTestCard
        );
        await expectSubscriptionUpdated(customer, testPlan.id, "active");
        await cancelSubscriptionInPortal(customer, page);
        await expectSubscriptionUpdatedCancelRequest(customer, testPlan.id);
        await advanceClock(timeId);
        await expectSubscriptionDeleted(customer, testPlan.id);
      });
    });
  });
  it("testStripePlanSubChange", async () => {});
  it("testStripePlanSubPaymentFail", async () =>
    withTime(async (timeId) =>
      withCustomer({ timeId }, async (customer: User) => {
        await signupSubscriptionInPortal(
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
            "customer.subscription.created",
            customer,
            testPlan.id,
            "incomplete"
          )
        );
        await advanceClock(timeId);
        await expect(
          expectSubscriptionEvent(
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
          customer,
          plan,
          page,
          infiniteTestCard
        );
        await expectSubscriptionEvent(
          "customer.subscription.updated",
          customer,
          plan.id,
          "active"
        );
        await stripePay.destroyPlan(plan.id);
        await expect(
          signupSubscriptionInPortal(customer, plan, page, infiniteTestCard)
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

async function signupSubscriptionInPortal(
  customer: User,
  plan: Plan,
  page: Page,
  card: string
) {
  const url = z.string().parse(
    await stripePay.getPlanUrl({
      customerId: customer.customerId,
      planId: plan.id,
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
  await page.getByPlaceholder("1234 1234 1234").fill(card);
  await page.getByPlaceholder("MM / YY").click();
  await page.getByPlaceholder("MM / YY").fill("01 / 26");
  await page.getByPlaceholder("CVC").click();
  await page.getByPlaceholder("CVC").fill("123");
  await page.getByPlaceholder("MM / YY").click();
  await page.getByPlaceholder("Full name on card").click();
  await page.getByPlaceholder("Full name on card").fill("test");
  await page.getByTestId("hosted-payment-submit-button").click();
}

async function expectSubscriptionUpdatedCancelRequest(
  customer: User,
  planId: string
) {
  await expect(
    hook.listen({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: customer.customerId,
          cancel_at_period_end: true,
          status: "active",
        },
      },
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
  const portalUrl = z.string().parse(
    await stripePay.getPortalUrl(customer.customerId, {
      returnUrl: "http://localhost",
    })
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

async function expectSubscriptionUpdated(
  customer: User,
  planId: string,
  status: "active" | "canceled" | "incomplete"
) {
  await expect(
    hook.listen({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: customer.customerId,
          status,
        },
      },
    })
  ).resolves.toMatchObject({
    type: "customer.subscription.updated",
    data: {
      object: {
        customer: customer.customerId,
        start_date: expect.any(Number),
        current_period_end: expect.any(Number),
        current_period_start: expect.any(Number),
        status,
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

async function expectSubscriptionEvent(
  type:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted",
  customer: User,
  planId: string,
  status: "active" | "canceled" | "incomplete"
) {
  await expect(
    hook.listen({
      type,
      data: {
        object: {
          customer: customer.customerId,
          status,
        },
      },
    })
  ).resolves.toMatchObject({
    type,
    data: {
      object: {
        customer: customer.customerId,
        start_date: expect.any(Number),
        current_period_end: expect.any(Number),
        current_period_start: expect.any(Number),
        status,
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

async function expectSubscriptionDeleted(customer: User, planId: string) {
  await expect(
    hook.listen({
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: customer.customerId,
          status: "canceled",
        },
      },
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
