import { getWorkspaceUsers, slackPost } from "../../lib/slack";

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const users = await getWorkspaceUsers();
  let sent = 0;

  for (const user of users) {
    const dm = await slackPost("conversations.open", { users: user.id });
    const channelId = dm.channel?.id;
    if (!channelId) continue;

    await slackPost("chat.postMessage", {
      channel: channelId,
      text: "Время заполнить отчёт за день 📋",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Привет! 👋 Время заполнить отчёт за день.\nЯ подтяну твои задачи из Jira автоматически.",
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "✍️ Заполнить отчёт", emoji: true },
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
