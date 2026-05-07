const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

export async function slackGet(endpoint, params = {}) {
  const url = new URL(`https://slack.com/api/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${SLACK_TOKEN}` },
  });
  return res.json();
}

export async function slackPost(endpoint, body) {
  const res = await fetch(`https://slack.com/api/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getWorkspaceUsers() {
  const data = await slackGet("users.list");
  return (data.members || []).filter(
    (m) => !m.is_bot && !m.deleted && m.id !== "USLACKBOT"
  );
}

export async function getUserEmail(userId) {
  const data = await slackGet("users.info", { user: userId });
  return data.user?.profile?.email;
}
