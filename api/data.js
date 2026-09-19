import { db } from 'hatchable';

export const access = 'user';
export const methods = ['GET', 'PUT', 'POST'];

const empty = { money: [], expenses: [], borrow: [], savings: [], splits: [], splitGroups: [] };

function clean(input) {
  const d = input && typeof input === 'object' ? input : {};
  return {
    money: Array.isArray(d.money) ? d.money : [],
    expenses: Array.isArray(d.expenses) ? d.expenses : [],
    borrow: Array.isArray(d.borrow) ? d.borrow : [],
    savings: Array.isArray(d.savings) ? d.savings : [],
    splits: Array.isArray(d.splits) ? d.splits : [],
    splitGroups: Array.isArray(d.splitGroups) ? d.splitGroups : []
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
      'SELECT data, updated_at FROM expense_data WHERE user_id = $1',
      [userId]
    );
    const row = rows[0];
    console.log('expense_data GET', { userId, found: !!row });
    return res.json({ data: row?.data || empty, updatedAt: row?.updated_at || null });
  }

  const data = clean(req.body);
  const result = await db.query(
    `INSERT INTO expense_data (user_id, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
     RETURNING data, updated_at`,
    [userId, JSON.stringify(data)]
  );
  const row = result.rows[0];
  console.log('expense_data PUT', { userId, inserted: !!row, counts: { money:data.money.length, expenses:data.expenses.length, savings:data.savings.length, borrow:data.borrow.length, splits:data.splits.length } });
  return res.json({ ok: true, data: row?.data || data, updatedAt: row?.updated_at || null });
}