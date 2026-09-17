import { db } from 'hatchable';

export const access = 'user';
export const methods = ['GET', 'PUT', 'POST'];

const empty = { money: [], expenses: [], borrow: [], savings: [] };

function clean(input) {
  const d = input && typeof input === 'object' ? input : {};
  return {
    money: Array.isArray(d.money) ? d.money : [],
    expenses: Array.isArray(d.expenses) ? d.expenses : [],
    borrow: Array.isArray(d.borrow) ? d.borrow : [],
    savings: Array.isArray(d.savings) ? d.savings : []
  };
}

export default async function (req, res) {
  // This route is gated as an end-user route, so scope all data to req.user.
  // Do not fall back to collaborator identity: that can be null for end users.
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Signed-in user identity is missing.' });
  }

  if (req.method === 'GET') {
    const { rows } = await db.query(
      'SELECT data FROM expense_data WHERE user_id = $1',
      [userId]
    );
    return res.json(rows[0]?.data || empty);
  }

  const data = clean(req.body);
  await db.query(
    `INSERT INTO expense_data (user_id, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()` ,
    [userId, JSON.stringify(data)]
  );
  return res.json({ ok: true, data });
}