import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";

// Read static matcher without loading the auth proxy and its environment.
const source = readFileSync(new URL("./proxy.js", import.meta.url), "utf8");
const matcher = JSON.parse(source.match(/matcher:\s*\[\s*(".*")/)[1]);
const config = { matcher: [matcher] };
describe("Android association", () => {
  test("publishes the supplied release signing certificate and package", () => {
    const association = JSON.parse(readFileSync(new URL("../public/.well-known/assetlinks.json", import.meta.url), "utf8"));
    expect(association).toEqual([{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: "com.perimediagroup.triggerfeed",
        sha256_cert_fingerprints: ["45:DE:7E:A5:B0:AF:85:42:59:71:90:67:04:72:17:C8:CD:C8:E0:AE:32:A1:44:88:2A:65:EA:EB:59:16:3D:1B"] },
    }]);
  });
  test("association bypasses auth proxy while private pages remain matched", () => {
    expect(doesProxyMatch({ config, url: "/.well-known/assetlinks.json" })).toBe(false);
    for (const url of ["/admin", "/profile", "/signup", "/posts/range-day"]) {
      expect(doesProxyMatch({ config, url })).toBe(true);
    }
  });
});
