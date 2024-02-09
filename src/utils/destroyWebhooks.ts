import Stripe from "stripe";

export async function destroyWebhooks(stripe: Stripe, description: string) {
  const all = await stripe.webhookEndpoints.list({
    limit: 5,
  });
  const some = all.data.filter((w) => w.description?.includes(description));
  console.log("destroyWebhooks1", {
    allCount: all.data.length,
    destroyCount: some.length,
  });
  await Promise.all(some.map((w) => stripe.webhookEndpoints.del(w.id)));
}
