const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECTS = (process.env.JIRA_PROJECTS || "NBW,NB,NET,CB").split(",");

function authHeader() {
  return Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64");
}

async function jiraGet(path) {
  const res = await fetch(`https://${JIRA_DOMAIN}/rest/api/3${path}`, {
    headers: {
      Authorization: `Basic ${authHeader()}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getJiraAccountId(email) {
  const data = await jiraGet(`/user/search?query=${encodeURIComponent(email)}`);
  return Array.isArray(data) ? data[0]?.accountId : null;
}

export async function getUserTodayIssues(email) {
  const accountId = await getJiraAccountId(email);
  if (!accountId) return [];

  const today = new Date().toISOString().split("T")[0];
  const projectFilter = PROJECTS.map((p) => `"${p}"`).join(",");
  const jql = `project in (${projectFilter}) AND assignee = "${accountId}" AND updated >= "${today}" ORDER BY updated DESC`;

  const data = await jiraGet(
    `/search?${new URLSearchParams({ jql, fields: "summary,status", maxResults: "5" })}`
  );

  return (data?.issues || []).map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
  }));
}
