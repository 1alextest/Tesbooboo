import { TesboClient, tesboTag, readConfigFile, type TesboReporterOptions, type FileConfig } from "@tesbox/playwright-reporter";

const options: TesboReporterOptions = { enabled: false, strict: true };
const config: FileConfig = readConfigFile();
const tag: string = tesboTag("PACKAGE-TC-1");
const client: TesboClient = new TesboClient({ baseUrl: "http://127.0.0.1", projectId: "fixture", token: "fixture" });
void [options, config.values, tag, client];
