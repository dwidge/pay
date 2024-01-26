import Stripe from "stripe";

export async function destroyWebhooks(stripe: Stripe, description: string) {
  const webhookEndpoints = await stripe.webhookEndpoints.list({
    limit: 3,
  });
  await Promise.all(
    webhookEndpoints.data
      .filter((w) => w.description?.includes(description))
      .map((w) => stripe.webhookEndpoints.del(w.id))
  );
}
