// Copyright DWJ 2023.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import axios from "axios";
import crypto from "crypto";
import dns from "node:dns";

import { PayfastEnv } from "./PayfastTypes.js";

export function getParamString(pfData: Record<string, string>) {
  let pfParamString = "";
  for (let key in pfData) {
    if (pfData.hasOwnProperty(key) && key !== "signature") {
      pfParamString += `${key}=${encodeURIComponent(
        pfData[key].toString().trim()
      ).replace(/%20/g, "+")}&`;
    }
  }

  // Remove last ampersand
  pfParamString = pfParamString.slice(0, -1);
  return pfParamString;
}

export const getSignature = (pfParamString: string, pfPassphrase: string) => {
  // Calculate security signature
  if (pfPassphrase) {
    pfParamString += `&passphrase=${encodeURIComponent(
      pfPassphrase.trim()
    ).replace(/%20/g, "+")}`;
  }

  const signature = crypto
    .createHash("md5")
    .update(pfParamString)
    .digest("hex");
  return signature;
};

export const getSignedParamString = (
  paramString: string,
  signature: string
) => {
  return paramString + "&signature=" + signature;
};

export async function ipLookup(domain: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    dns.lookup(
      domain,
      { all: true },
      (
        err: NodeJS.ErrnoException | null,
        address: string | dns.LookupAddress[],
        family: number
      ) => {
        if (err) {
          reject(err);
        } else {
          resolve(
            address instanceof Array ? address.map((v) => v.address) : [address]
          );
        }
      }
    );
  });
}

const pfValidIP = async (headers: Record<string, string | string[]>) => {
  const validHosts = [
    "www.payfast.co.za",
    "sandbox.payfast.co.za",
    "w1w.payfast.co.za",
    "w2w.payfast.co.za",
  ];

  const pfIp = headers["x-forwarded-for"];
  const validIps = (await Promise.all(validHosts.map(ipLookup))).flat();

  if (!validIps.includes(pfIp instanceof Array ? pfIp[0] : pfIp)) {
    console.log("pfValidIPE1", pfIp, headers, validIps);
    throw new Error("pfValidIPE1");
  }
};

const pfValidServerConfirmation = async (
  pfHost: string,
  pfParamString: string
) => {
  const result = await axios
    .post(`https://${pfHost}/eng/query/validate`, pfParamString)
    .then((res) => {
      return res.data;
    })
    .catch((error) => {
      console.error("pfValidServerConfirmationE1", error);
      throw new Error("pfValidServerConfirmationE1");
    });

  if (result !== "VALID") {
    console.log("pfValidServerConfirmationE2", {
      result,
      pfHost,
      pfParamString,
    });
    throw new Error("pfValidServerConfirmationE2");
  }
};

//developers.payfast.co.za/docs#step_4_confirm_payment
export async function validatePayfast(
  payload: string | Buffer,
  headers: Record<string, string | string[]>,
  env: PayfastEnv
) {
  const { passPhrase = "", host = "sandbox.payfast.co.za" } = env;
  const pfData = JSON.parse(payload.toString());
  const pfParamString = getParamString(pfData);

  if (pfData["signature"] !== getSignature(pfParamString, passPhrase))
    throw new Error("validateE1");

  if (env.hookCheckAddress) await pfValidIP(headers);
  if (env.hookCheckServer) await pfValidServerConfirmation(host, pfParamString);
}

export function pingPayfast({
  merchantId = "",
  passPhrase = "",
  host = "sandbox.payfast.co.za",
}: Pick<PayfastEnv, "merchantId" | "passPhrase" | "host">) {
  const data: Record<string, string> = {
    "merchant-id": merchantId,
    version: "v1",
    timestamp: new Date().toString(),
  };
  data["signature"] = getSignature(getParamString(data), passPhrase);

  return axios
    .get<"Payfast API" | "API V1">(`https://${host}/ping`, { headers: data })
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw new Error("pingE1", { cause: e.response.data });
    });
}
