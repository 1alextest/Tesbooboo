import Reporter, { TesboClient, tesboTag, type TesboReporterOptions } from "@tesbox/playwright-reporter";
import type { Reporter as PlaywrightReporter } from "@playwright/test/reporter";

const options: TesboReporterOptions = { enabled: false, attachEvidence: "never", timeoutMs: 1000 };
const reporter: PlaywrightReporter = new Reporter(options);
const client: TesboClient = new TesboClient({ baseUrl: "http://127.0.0.1", projectId: "fixture", token: "fixture" });
const tag: string = tesboTag("PACKAGE-TC-1");
void [reporter, client, tag];
// These must be real declarations, not an untyped module that accepts anything.
// @ts-expect-error unknown attachment policy
const invalid: TesboReporterOptions = { attachEvidence: "sometimes" };
// @ts-expect-error case IDs are strings
tesboTag(123);
void invalid;
