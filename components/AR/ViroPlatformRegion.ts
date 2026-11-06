/**
 * Copyright © 2026 ReactVision
 */

"use strict";

/** ReactVision Studio, the default address of every call viro makes to the platform. */
export const PLATFORM_ENDPOINT = "https://platform.reactvision.xyz";

/**
 * PLATFORM_ENDPOINT's database region, so its edge functions run beside the
 * database. The query parameter rather than an `x-region` header, which a
 * browser would have to clear through a CORS preflight the platform does not
 * allow it in.
 */
export const PLATFORM_FUNCTION_REGION = "eu-west-2";

// What the gateway answers when it never reached a function. With a non-JSON
// body (every platform function answers JSON) nothing ran, so a resend cannot
// run a request twice. 500, 504, 520, 524 and 546 are left out: a function may
// have run before any of them.
const UNDELIVERED_STATUSES = new Set([502, 503, 521, 522, 523, 525, 526, 530]);

export function platformUndelivered(response: Response): boolean {
  return (
    UNDELIVERED_STATUSES.has(response.status) &&
    !/json/i.test(response.headers.get("content-type") ?? "")
  );
}

// The region's runtime answers the bare path itself, with CORS headers and
// without starting a function.
export async function platformRegionAnswers(base: string, region: string): Promise<boolean> {
  try {
    return !platformUndelivered(
      await fetch(`${base}/functions/v1/?forceFunctionRegion=${region}`)
    );
  } catch {
    return false;
  }
}
