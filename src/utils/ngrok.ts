import ngrok from "@ngrok/ngrok";

export const makeNgrokListener = (addr?: string | number) =>
  ngrok
    .forward({ addr, authtoken_from_env: true })
    .then((listener) => {
      const url = listener.url();
      if (!url) throw new Error("ngrokListenerE1");
      const close = async () => {
        await listener.close();
      };
      return { url, close };
    })
    .catch((e) => {
      throw new Error("ngrokListenerE2: " + e.message, { cause: e });
    });
