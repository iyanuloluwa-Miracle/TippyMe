import { CreatorsService } from '../../../../services/creators/creators.service';
import { requireUser } from '../../../../lib/auth';
import { defineApiHandler } from '../../../../lib/define-api';

export default defineApiHandler(async (event) => {
  const user = await requireUser(event);
  const creators = new CreatorsService();
  const csv = await creators.exportTipsCsv(user.sub);
  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
  setHeader(event, 'Content-Disposition', 'attachment; filename="tippyme-tips.csv"');
  return csv;
});
