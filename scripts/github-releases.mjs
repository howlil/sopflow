#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const released = JSON.parse(process.env.SOPFLOW_RELEASED_PACKAGES ?? "[]");
const commit = process.env.SOPFLOW_RELEASE_SHA;
if (!Array.isArray(released)) throw new Error("Invalid release output");
if (released.length && !/^[0-9a-f]{40}$/.test(commit ?? "")) throw new Error("Missing release commit SHA");

for (const item of released) {
  if (!/^@sopflow\/[a-z0-9-]+$/.test(item.name) || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(item.version)) {
    throw new Error("Invalid package release metadata");
  }
  const tag = item.name + "@" + item.version;
  try {
    execFileSync("gh", ["release", "view", tag], { stdio: "ignore" });
    console.log("GitHub release already exists: " + tag);
  } catch {
    execFileSync("gh", ["release", "create", tag, "--target", commit, "--title", tag,
      "--notes", "Published " + tag + " to npm.\n\nPackage: https://www.npmjs.com/package/" +
        item.name + "/v/" + item.version + "\nChangelog: https://github.com/howlil/sopflow/blob/master/" +
        item.directory + "/CHANGELOG.md"],
    { stdio: "inherit" });
    console.log("Created GitHub release " + tag);
  }
}
