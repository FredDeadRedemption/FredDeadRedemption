const token = process.env.GH_TOKEN;
if (!token) throw new Error("GH_TOKEN missing");

async function gql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: `bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

const { viewer } = await gql(`{
  viewer {
    createdAt
    pullRequests(first: 1) { totalCount }
  }
}`);

// contributionsCollection windows are capped at one year, so walk year by year
const firstYear = new Date(viewer.createdAt).getUTCFullYear();
const thisYear = new Date().getUTCFullYear();
let commits = 0;

for (let year = firstYear; year <= thisYear; year++) {
  const { viewer: v } = await gql(
    `query($f: DateTime!, $t: DateTime!) {
      viewer {
        contributionsCollection(from: $f, to: $t) {
          totalCommitContributions
          restrictedContributionsCount
        }
      }
    }`,
    { f: `${year}-01-01T00:00:00Z`, t: `${year}-12-31T23:59:59Z` },
  );
  const c = v.contributionsCollection;
  commits += c.totalCommitContributions + c.restrictedContributionsCount;
}

const badge = (label, value) =>
  JSON.stringify({ schemaVersion: 1, label, message: value.toLocaleString("en-US"), color: "blue" }) + "\n";

const { writeFile } = await import("node:fs/promises");
await writeFile("badges/commits.json", badge("commits", commits));
await writeFile("badges/prs.json", badge("pull requests", viewer.pullRequests.totalCount));
console.log(`commits=${commits} prs=${viewer.pullRequests.totalCount}`);
