#!/usr/bin/env node
/** Verify native GitHub identity and signed HEAD after bot publication. */
import { pathToFileURL } from "node:url";

const REPO = "1alextest/Tesbooboo";
const SHA = /^[0-9a-f]{40}$/i;

export function verifyPublishedPr({ pr, commit, appSlug, branch }) {
  if (typeof appSlug !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(appSlug)) {
    throw new Error("Verified GitHub App slug unavailable");
  }
  const bot = appSlug + "[bot]";
  if (pr?.user?.login !== bot || pr?.user?.type !== "Bot" ||
      pr?.base?.ref !== "development" || pr?.head?.ref !== branch ||
      pr?.head?.repo?.full_name !== REPO || pr?.draft !== true ||
      pr?.state !== "open" || !SHA.test(pr?.head?.sha ?? "")) {
    throw new Error("Published PR lacks expected bot author, base, draft or exact repository identity");
  }
  if (commit?.sha !== pr.head.sha ||
      commit?.commit?.verification?.verified !== true ||
      commit?.commit?.verification?.reason !== "valid" ||
      commit?.committer?.login !== bot) {
    throw new Error("PR HEAD lacks native verified bot commit signature/identity");
  }
  return { prNumber: pr.number, sha: pr.head.sha, bot };
}

async function githubRead(path, token, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl("https://api.github.com/repos/" + REPO + path, {
      redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28" }
    });
  } catch {
    throw new Error("Native publication readback unavailable");
  }
  if (!response.ok) throw new Error("Native publication readback unavailable");
  try { return await response.json(); } catch {
    throw new Error("Native publication readback malformed");
  }
}

export async function checkPublishedPr(env = process.env, fetchImpl = fetch) {
  const number = env.PR_NUMBER;
  const sha = env.SOURCE_SHA;
  const branch = env.BOT_BRANCH;
  if (!/^[1-9]\d{0,8}$/.test(number ?? "") ||
      !SHA.test(sha ?? "") || branch !== "tesbo-agent/" + sha.toLowerCase() ||
      !env.APP_TOKEN || !env.APP_SLUG ||
      env.GITHUB_REPOSITORY !== REPO) {
    throw new Error("Invalid bot publication verification context");
  }
  const pr = await githubRead("/pulls/" + number, env.APP_TOKEN, fetchImpl);
  if (!SHA.test(pr?.head?.sha ?? "")) throw new Error("Published PR head SHA unavailable");
  const commit = await githubRead("/commits/" + pr.head.sha, env.APP_TOKEN, fetchImpl);
  return verifyPublishedPr({ pr, commit, appSlug: env.APP_SLUG, branch });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkPublishedPr().then(r => {
    console.log("Verified bot-authored signed draft PR #" + r.prNumber + " at exact HEAD " + r.sha);
    console.log("Independent assurance and human approval remain required; not merged");
  }).catch(error => {
    console.error("Bot PR publication verification refused: " + error.message);
    process.exitCode = 1;
  });
}
