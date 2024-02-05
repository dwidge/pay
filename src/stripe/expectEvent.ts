import { expect } from "expect";
import { User } from "../Pay.js";
import {
  getSecondsFromDate,
  getSecondsFromDays,
} from "../utils/getSecondsFromDate.js";
import { TestStripeWebhook } from "../utils/makeTestStripeWebhook.js";

export async function expectSubscriptionUpdatedCancelRequest(
  hook: TestStripeWebhook,
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

export async function expectSubscriptionUpdated(
  hook: TestStripeWebhook,
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

export async function expectSubscriptionEvent(
  hook: TestStripeWebhook,
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

export async function expectSubscriptionDeleted(
  hook: TestStripeWebhook,
  customer: User,
  planId: string
) {
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
