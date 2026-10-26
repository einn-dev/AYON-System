/* Some columns are added by a later SQL file (for example return_reason).
   If the admin has not run that SQL yet, a write that includes them fails
   with "column does not exist". This runs the write with the extra columns
   first and, only for that specific error, again without them, so the main
   action still works while the SQL is pending.

   run(payload) must return the Supabase query (awaitable).                 */

const isMissingColumn = (error) => {
  if (!error) return false;
  const text = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return error.code === '42703' || error.code === 'PGRST204'
      || (text.includes('column') && (text.includes('does not exist') || text.includes('schema cache')));
};

const withOptionalColumns = async (run, base, extra) => {
  const first = await run({ ...base, ...extra });
  if (!isMissingColumn(first.error)) return { ...first, usedExtra: true };
  const second = await run(base);
  return { ...second, usedExtra: false };
};

module.exports = { withOptionalColumns, isMissingColumn };