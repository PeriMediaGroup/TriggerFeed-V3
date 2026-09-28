import { expect, it } from "vitest";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

it("ships an opaque email redaction in the actual public profile asset", async () => {
  const path = fileURLToPath(new URL("../../../public/images/welcome/triggerfeed-profile-desktop.png", import.meta.url));
  const metadata = await sharp(path).metadata();
  expect([metadata.width, metadata.height]).toEqual([1379, 922]);
  const pixels = await sharp(path).extract({ left: 800, top: 324, width: 280, height: 42 }).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0 || pixels[i + 3] !== 255) {
      throw new Error("The screenshot email region must be fully opaque black.");
    }
  }
});
