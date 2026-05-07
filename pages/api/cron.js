import { getWorkspaceUsers, slackPost } from "../../lib/slack";

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const allowedEmails = (process.env.ALLOWED_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
  const users = await getWorkspaceUsers();
  const filtered = users.filter(u => allowedEmails.includes(u.profile?.email?.toLowerCase()));

  let sent = 0;
  for (const user of filtered) {
    const dm = await slackPost("conversations.open", { users: user.id });
    const channelId = dm.channel?.id;
    if (!channelId) continue;

    await slackPost("chat.postMessage", {
      channel: channelId,
      text: "Time to submit your daily report",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Hey! Time to submit your daily report.\nI will pull your Jira tasks for today automatically.",
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Fill in report", emoji: true },
              style: "primary",
              action_id: "open_report_modal",
            },
          ],
        },
      ],
    });
    sent++;
  }

  res.status(200).json({ ok: true, sent });
}
