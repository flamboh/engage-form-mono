import { expect, test } from "vite-plus/test";
import { readFile } from "node:fs/promises";

const sampleFiles = [
  { path: "/sample/Oliver_ID_1.jpg", magic: [0xff, 0xd8, 0xff] },
  { path: "/sample/Oliver_ID_2.jpg", magic: [0xff, 0xd8, 0xff] },
  { path: "/sample/approval_email.pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  { path: "/sample/mort_garson_receipt.jpg", magic: [0xff, 0xd8, 0xff] },
  { path: "/sample/weekly_event_engage.pdf", magic: [0x25, 0x50, 0x44, 0x46] },
];

test("bundles valid upload fixture bytes", async () => {
  for (const file of sampleFiles) {
    const bytes = await readFile(new URL(`../public${file.path}`, import.meta.url));
    expect(Array.from(bytes.slice(0, file.magic.length))).toEqual(file.magic);
  }
});
