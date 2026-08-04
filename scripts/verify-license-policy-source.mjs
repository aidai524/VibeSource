import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const snapshotUrl = new URL("../src/domain/license-policy-source.json", import.meta.url);
const snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));
const response = await fetch(snapshot.source, {
  headers: { accept: "application/json", "user-agent": "VibeSource-license-policy-source-verifier" },
  redirect: "error",
  signal: AbortSignal.timeout(10_000),
});
if (!response.ok) throw new Error(`SPDX source returned HTTP ${response.status}.`);
const bytes = Buffer.from(await response.arrayBuffer());
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (sha256 !== snapshot.sha256) {
  throw new Error(`SPDX source SHA-256 mismatch: expected ${snapshot.sha256}, received ${sha256}.`);
}
const source = JSON.parse(bytes.toString("utf8"));
const approvedSpdxIds = source.licenses
  .filter((license) => license.isOsiApproved === true && license.isDeprecatedLicenseId !== true)
  .map((license) => license.licenseId)
  .sort();
if (source.licenseListVersion !== snapshot.licenseListVersion) {
  throw new Error("SPDX license list version does not match the policy snapshot.");
}
if (JSON.stringify(approvedSpdxIds) !== JSON.stringify(snapshot.approvedSpdxIds)) {
  throw new Error("Derived OSI-approved SPDX identifiers do not match the policy snapshot.");
}
console.log(
  `Verified SPDX ${source.licenseListVersion}: ${approvedSpdxIds.length} OSI-approved, non-deprecated identifiers; SHA-256 ${sha256}.`,
);
