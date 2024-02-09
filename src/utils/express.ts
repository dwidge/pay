declare module "express" {
  interface Request {
    raw?: Buffer;
  }
}
declare module "http" {
  interface IncomingMessage {
    raw: Buffer;
  }
}
