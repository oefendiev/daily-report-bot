import { getUserTodayIssues, getJiraAccountId } from "../../lib/jira";

export default async function handler(req, res) {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "email required" });
  
  const accountId = await getJiraAccountId(email);
  const issues = await getUserTodayIssues(email);
  
  res.status(200).json({ email, accountId, issues });
}
