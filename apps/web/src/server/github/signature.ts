import { createHmac, timingSafeEqual } from "node:crypto";

export function computeGithubWebhookSignature(payload: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export function verifyGithubWebhookSignature(payload: string, signature: string | null, secret: string) {
  if (!signature) {
    return false;
  }

  const expected = computeGithubWebhookSignature(payload, secret);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
