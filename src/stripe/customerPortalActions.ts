import { Page } from "playwright";

export async function signupSubscriptionInPortal(
  page: Page,
  url: string,
  card: string
) {
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
  page: Page,
  portalUrl: string
) {
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
  page: Page,
  portalUrl: string,
  planName: string | RegExp
) {
  console.log("Visit this page and change plan:", planName, portalUrl);
  await page.goto(portalUrl);
  await page.locator('[data-test="update-subscription"]').click();
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${planName}.*Select$`) })
    .getByRole("button")
    .click();
  await page.getByTestId("continue-button").click();
  await page.getByTestId("confirm").click();
  await page.getByTestId("return-to-business-link").click();
}

export async function changePaymentMethodInPortal(
  page: Page,
  portalUrl: string,
  card: string
) {
  console.log("Visit this page and add payment method:", card, portalUrl);
  await page.goto(portalUrl);
  await page.getByRole("link", { name: "Add payment method" }).click();
  const frame = page
    .frameLocator('iframe[name*="__privateStripeFrame"]')
    .first();
  await frame.getByPlaceholder("1234 1234 1234").click();
  await frame.getByPlaceholder("1234 1234 1234").fill(card);
  await frame.getByPlaceholder("MM / YY").click();
  await frame.getByPlaceholder("MM / YY").fill("12 / 25");
  await frame.getByPlaceholder("CVC").click();
  await frame.getByPlaceholder("CVC").fill("123");
  await page.getByTestId("confirm").click();
  await page.getByRole("button", { name: "More options" }).click();
  await page
    .locator('[data-test="nonDefaultPaymentInstrumentDeleteButton"]')
    .click();
  await page
    .locator('[data-test="PaymentInstrumentActionsDetatchModalConfirmButton"]')
    .click();
}
