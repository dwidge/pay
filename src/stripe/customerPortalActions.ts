import { expect } from "expect";
import { z } from "zod";
import { Plan, User } from "../Pay.js";
import { Page } from "playwright";
import { StripePay } from "./StripePay.js";

export async function signupSubscriptionInPortal(
  stripePay: StripePay,
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

export async function cancelSubscriptionInPortal(
  stripePay: StripePay,
  customer: User,
  page: Page
) {
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

export async function changeSubscriptionInPortal(
  stripePay: StripePay,
  customer: User,
  page: Page,
  planName: string | RegExp
) {
  const portalUrl = z.string().parse(
    await stripePay.getPortalUrl(customer.customerId, {
      returnUrl: "http://localhost",
    })
  );
  console.log("Visit this page and change plan:", portalUrl);

  await page.goto(portalUrl);
  await page.locator('[data-test="update-subscription"]').click();
  // await page
  //   .locator("div")
  //   .filter({ hasText: planName })
  //   .getByRole("button")
  //   .click();
  await page.getByText(planName).getByRole("button").click();
  await page.getByTestId("continue-button").click();
  await page.getByTestId("confirm").click();
  await page.getByTestId("return-to-business-link").click();
}
