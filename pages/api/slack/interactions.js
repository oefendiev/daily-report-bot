cat > ~/daily-report-bot/pages/api/slack/interactions.js << 'EOF'
import { getUserEmail, slackPost } from "../../../lib/slack";
import { getUserTodayIssues } from "../../../lib/jira";

export const config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function buildModal(issues) {
  const blocks = [];

  if (issues.length === 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "⚠️ No Jira tasks found for today. Fill in manually:" } });
    blocks.push({ type: "input", block_id: "manual_task", label: { type: "plain_text", text: "Task (number and title)" }, element: { type: "plain_text_input", action_id: "value", placeholder: { type: "plain_text", text: "PROJ-123 JWT Authorization" } } });
    blocks.push({ type: "input", block_id: "manual_status", label: { type: "plain_text", text: "Status" }, element: { type: "static_select", action_id: "value", options: [{ text: { type: "plain_text", text: "✅ Done" }, value: "done" }, { text: { type: "plain_text", text: "🔄 In Progress" }, value: "in_progress" }, { text: { type: "plain_text", text: "🚫 Blocked" }, value: "blocked" }] } });
    blocks.push({ type: "input", block_id: "manual_what", label: { type: "plain_text", text: "What did you do" }, element: { type: "plain_text_input", action_id: "value", multiline: true } });
    blocks.push({ type: "input", block_id: "manual_hours", label: { type: "plain_text", text: "Hours spent" }, element: { type: "plain_text_input", action_id: "value", placeholder: { type: "plain_text", text: "2.5" } } });
  } else {
    issues.forEach((issue, idx) => {
      if (idx > 0) blocks.push({ type: "divider" });
      blocks.push({ type: "section", text: { type: "mrkdwn", text: `*${issue.key}* · ${issue.summary}\n_${issue.status}_` } });
      blocks.push({ type: "input", block_id: `task_${issue.key}_what`, label: { type: "plain_text", text: "What did you do" }, optional: true, element: { type: "plain_text_input", action_id: "value", multiline: true } });
      blocks.push({ type: "input", block_id: `task_${issue.key}_hours`, label: { type: "plain_text", text: "Hours spent" }, optional: true, element: { type: "plain_text_input", action_id: "value", placeholder: { type: "plain_text", text: "2.5" } } });
    });
  }

  return {
    type: "modal",
    callback_id: "daily_report_submit",
    private_metadata: JSON.stringify({ issues }),
    title: { type: "plain_text", text: "Daily Report" },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks,
  };
}

function formatStatus(status) {
  const s = status?.toLowerCase() || "";
  if (s.includes("done") || s.includes("closed") || s.includes("resolved")) return "✅ Done";
  if (s.includes("progress")) return "🔄 In Progress";
  if (s.includes("block")) return "🚫 Blocked";
  return status;
}

async function handleBlockActions(payload, res) {
  const action = payload.actions?.[0];
  if (action?.action_id !== "open_report_modal") return res.status(200).end();
  const email = await getUserEmail(payload.user.id);
  const issues = email ? await getUserTodayIssues(email) : [];
  await slackPost("views.open", { trigger_id: payload.trigger_id, view: buildModal(issues) });
  return res.status(200).end();
}

async function handleViewSubmission(payload, res) {
  const values = payload.view.state.values;
  const { issues = [] } = JSON.parse(payload.view.private_metadata || "{}");
  const userName = payload.user.name;
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const lines = [`*📋 Daily Report — ${date} — @${userName}*\n`];

  if (issues.length === 0) {
    const task = values.manual_task?.value?.value || "—";
    const statusKey = values.manual_status?.value?.selected_option?.value;
    const status = { done: "✅ Done", in_progress: "🔄 In Progress", blocked: "🚫 Blocked" }[statusKey] || "—";
    const what = values.manual_what?.value?.value || "";
    const hours = values.manual_hours?.value?.value || "";
    lines.push(`*${task}* · ${status}`);
    if (what) lines.push(what);
    if (hours) lines.push(`_⏱ ${hours}h_`);
  } else {
    let hasContent = false;
    for (const issue of issues) {
      const what = values[`task_${issue.key}_what`]?.value?.value;
      const hours = values[`task_${issue.key}_hours`]?.value?.value;
      if (!what && !hours) continue;
      hasContent = true;
      lines.push(`\n*${issue.key}* · ${issue.summary} · ${formatStatus(issue.status)}`);
      if (what) lines.push(what);
      if (hours) lines.push(`_⏱ ${hours}h_`);
    }
    if (!hasContent) {
      return res.status(200).json({ response_action: "errors", errors: { [`task_${issues[0].key}_what`]: "Please fill in at least one task" } });
    }
  }

  await slackPost("chat.postMessage", {
    channel: process.env.SLACK_REPORT_CHANNEL,
    text: lines.join("\n"),
    blocks: [{ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } }],
  });

  return res.status(200).json({});
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const rawBody = await getRawBody(req);
  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get("payload");
  if (!payloadStr) return res.status(400).end();
  const payload = JSON.parse(payloadStr);
  if (payload.type === "block_actions") return handleBlockActions(payload, res);
  if (payload.type === "view_submission") return handleViewSubmission(payload, res);
  return res.status(200).end();
}
EOF
