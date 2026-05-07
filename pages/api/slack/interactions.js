import { slackPost } from "../../../lib/slack";

export const config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function taskBlock(n, optional) {
  return [
    {
      type: "input",
      block_id: `task_${n}_name`,
      label: { type: "plain_text", text: optional ? `Task ${n} (optional)` : `Task ${n}` },
      optional,
      element: { type: "plain_text_input", action_id: "value", placeholder: { type: "plain_text", text: "NBW-123 Payment integration" } },
    },
    {
      type: "input",
      block_id: `task_${n}_status`,
      label: { type: "plain_text", text: "Status" },
      optional,
      element: {
        type: "static_select",
        action_id: "value",
        options: [
          { text: { type: "plain_text", text: "✅ Done" }, value: "Done" },
          { text: { type: "plain_text", text: "🔄 In Progress" }, value: "In Progress" },
          { text: { type: "plain_text", text: "🚫 Blocked" }, value: "Blocked" },
        ],
      },
    },
    {
      type: "input",
      block_id: `task_${n}_what`,
      label: { type: "plain_text", text: "What did you do" },
      optional,
      element: { type: "plain_text_input", action_id: "value", multiline: true },
    },
    {
      type: "input",
      block_id: `task_${n}_hours`,
      label: { type: "plain_text", text: "Hours spent" },
      optional,
      element: { type: "plain_text_input", action_id: "value", placeholder: { type: "plain_text", text: "2.5" } },
    },
    { type: "divider" },
  ];
}

function buildModal(count) {
  const blocks = [];
  for (let n = 1; n <= count; n++) {
    blocks.push(...taskBlock(n, n > 1));
  }
  if (count < 8) {
    blocks.push({
      type: "actions",
      block_id: "add_task_action",
      elements: [{
        type: "button",
        text: { type: "plain_text", text: "➕ Add task", emoji: true },
        action_id: "add_task",
      }],
    });
  }
  return {
    type: "modal",
    callback_id: "daily_report_submit",
    private_metadata: String(count),
    title: { type: "plain_text", text: "Daily Report" },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks,
  };
}

async function handleBlockActions(payload, res) {
  const action = payload.actions?.[0];

  if (action?.action_id === "open_report_modal") {
    await slackPost("views.open", { trigger_id: payload.trigger_id, view: buildModal(1) });
    return res.status(200).end();
  }

  if (action?.action_id === "add_task") {
    const count = parseInt(payload.view.private_metadata || "1") + 1;
    await slackPost("views.update", { view_id: payload.view.id, view: buildModal(count) });
    return res.status(200).end();
  }

  return res.status(200).end();
}

async function handleViewSubmission(payload, res) {
  const values = payload.view.state.values;
  const count = parseInt(payload.view.private_metadata || "1");
  const userName = payload.user.name;
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const lines = [`*📋 Daily Report — ${date} — @${userName}*`];

  for (let n = 1; n <= count; n++) {
    const name = values[`task_${n}_name`]?.value?.value;
    if (!name) continue;
    const status = values[`task_${n}_status`]?.value?.selected_option?.text?.text || "";
    const what = values[`task_${n}_what`]?.value?.value || "";
    const hours = values[`task_${n}_hours`]?.value?.value || "";
    lines.push(`\n*${name}* · ${status}`);
    if (what) lines.push(what);
    if (hours) lines.push(`_⏱ ${hours}h_`);
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
