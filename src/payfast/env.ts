import { PayfastEnv } from "./PayfastTypes.js";

export const getPayfastEnv = (
  env: Record<string, string | undefined> = process.env
) =>
  PayfastEnv.parse({
    host: env.PAYFAST_URL,
    merchantId: env.PAYFAST_MERCHANT_ID,
    merchantKey: env.PAYFAST_MERCHANT_KEY,
    passPhrase: env.PAYFAST_PASSPHRASE,
    buyUrl: env.PAYFAST_BUY_URL,
    returnUrl: env.PAYFAST_RETURN_URL,
    cancelUrl: env.PAYFAST_CANCEL_URL,
    notifyUrl: env.PAYFAST_NOTIFY_URL,
    hookCheckAddress: env.PAYFAST_HOOK_CHECK_ADDRESS === "true",
    hookCheckServer: env.PAYFAST_HOOK_CHECK_SERVER === "true",
  });
