import { db } from 'hatchable';

export const access = 'user';
export const methods = ['GET', 'PUT'];

const empty = { money: [], expenses: [], borrow: [], savings: [], splits: [], splitGroups: [], categories: [] };

function clean(input) {
  const d = input && typeof input === 'object' ? input : {};
  return {
    money: Array.isArray(d.money) ? d.money : [],
    expenses: Array.isArray(d.expenses) ? d.expenses : [],
    borrow: Array.isArray(d.borrow) ? d.borrow : [],
    savings: Array.isArray(d.savings) ? d.savings : [],
    splits: Array.isArray(d.splits) ? d.splits : [],
    splitGroups: Array.isArray(d.splitGroups) ? d.splitGroups : [],
    categories: Array.isArray(d.categories) ? d.categories.filter(x => typeof x === 'string') : []
  };
}

function hasRecords(d) {
  return Object.values(d).some(v => Array.isArray(v) && v.length > 0);
}

export default async function (req, res) {
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
    console.log('expense_data GET', JSON.stringify({ userId, found: !!row, hasData: !!row && hasRecords(row.data || {}) }));
    return res.json({ data: row?.data || empty, updatedAt: row?.updated_at || null });
  }

  const data = clean(req.body);
  const clientUpdatedAt = req.body?.clientUpdatedAt ? new Date(req.body.clientUpdatedAt) : null;
  const { rows: existingRows } = await db.query(
    'SELECT data, updated_at FROM expense_data WHERE user_id = $1',
    [userId]
  );
  const existing = existingRows[0];
  const existingHas = !!existing && hasRecords(existing.data || {});
  const incomingHas = hasRecords(data);

  // If the client knows which cloud revision it edited, reject stale writes.
  // This prevents an older tab/device from overwriting newer cloud data.
  if (existing?.updated_at && clientUpdatedAt && Number.isFinite(clientUpdatedAt.getTime())) {
    const serverAt = new Date(existing.updated_at);
    if (serverAt.getTime() > clientUpdatedAt.getTime() + 1000) {
      return res.status(409).json({
        error: 'stale_conflict',
        message: 'Cloud data changed on another device. Reload the latest data before saving.',
        updatedAt: existing.updated_at
      });
    }
  }

  // Never let an accidental empty client state erase a non-empty cloud account.
  // An explicit empty-state write is only allowed when the cloud row is already empty.
  if (existingHas && !incomingHas) {
    console.warn('expense_data PUT blocked empty overwrite', JSON.stringify({
      userId,
      existingUpdatedAt: existing.updated_at,
      existingCounts: Object.fromEntries(Object.entries(existing.data || {}).map(([k,v]) => [k, Array.isArray(v) ? v.length : 0]))
    }));
    return res.status(409).json({
      error: 'empty_overwrite_blocked',
      message: 'Cloud data was not changed because the incoming payload is empty.'
    });
  }

  const result = await db.query(
    `INSERT INTO expense_data (user_id, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
     RETURNING data, updated_at`,
    [userId, JSON.stringify(data)]
  );
  const row = result.rows[0];

  // Keep a server-side immutable snapshot of every non-empty successful save.
  if (incomingHas) {
    await db.query(
      `INSERT INTO expense_data_backups (user_id, data, source_updated_at)
       VALUES ($1, $2::jsonb, $3)`,
      [userId, JSON.stringify(data), row.updated_at]
    );
    // Keep only the latest 20 snapshots per account.
    await db.query(
      `DELETE FROM expense_data_backups
       WHERE user_id = $1
         AND id NOT IN (
           SELECT id FROM expense_data_backups
           WHERE user_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT 20
         )`,
      [userId]
    );
  }

  const verify = await db.query(
    'SELECT user_id, updated_at FROM expense_data WHERE user_id = $1',
    [userId]
  );
  console.log('expense_data PUT', JSON.stringify({
    userId,
    inserted: !!row,
    verifyRows: verify.rowCount,
    counts: {
      money: data.money.length,
      expenses: data.expenses.length,
      savings: data.savings.length,
      borrow: data.borrow.length,
      splits: data.splits.length
    }
  }));
  return res.json({
    ok: true,
    data: row?.data || data,
    updatedAt: row?.updated_at || null,
    persisted: verify.rowCount === 1
  });
}