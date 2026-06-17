import PDFDocument from 'pdfkit';

import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';
import { offsetMeta } from '../../utils/pagination.js';

import { reportsService } from './reports.service.js';

export const reportsController = {
  dashboard: asyncHandler(async (req, res) => {
    const data = await reportsService.dashboard({ tenantId: req.tenantId, query: req.query });
    res.json(ok(req, data));
  }),

  sales: asyncHandler(async (req, res) => {
    const data = await reportsService.sales({ tenantId: req.tenantId, query: req.query });
    const { rows, total, page, pageSize, ...rest } = data;
    res.json(ok(req, { rows, ...rest }, offsetMeta({ page, pageSize, total })));
  }),

  itemsPopularity: asyncHandler(async (req, res) => {
    const data = await reportsService.itemsPopularity({ tenantId: req.tenantId, query: req.query });
    res.json(ok(req, data));
  }),

  topCustomers: asyncHandler(async (req, res) => {
    const data = await reportsService.topCustomers({ tenantId: req.tenantId, query: req.query });
    res.json(ok(req, data));
  }),

  staffPerformance: asyncHandler(async (req, res) => {
    const data = await reportsService.staffPerformance({ tenantId: req.tenantId, query: req.query });
    res.json(ok(req, data));
  }),

  exportSales: asyncHandler(async (req, res) => {
    const { format = 'csv', async: asyncFlag } = req.query;

    // Large async build → queue + email.
    if (asyncFlag === 'true') {
      const result = await reportsService.enqueueExport({
        tenantId: req.tenantId,
        branchId: req.query.branchId,
        from: req.query.from,
        to: req.query.to,
        format,
        actor: req.user,
      });
      res.status(202).json(ok(req, result));
      return;
    }

    if (format === 'pdf') {
      const data = await reportsService.sales({ tenantId: req.tenantId, query: { ...req.query, page: 1, pageSize: 100000 } });
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="sales-report.pdf"');
      doc.pipe(res);
      doc.fontSize(20).fillColor('#0F172A').text('Sales Report', { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#64748B')
        .text(`Orders: ${data.kpis.orders}   Earnings: ${data.kpis.earnings.toFixed(2)}   Discounts: ${data.kpis.discounts.toFixed(2)}`);
      doc.moveDown(1);
      doc.fontSize(9).fillColor('#0F172A');
      doc.text('ID            Date                  Total     Payment   Status    Type');
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#E2E8F0');
      doc.moveDown(0.3);
      for (const r of data.rows.slice(0, 800)) {
        doc.text(`${r.id.padEnd(13)} ${new Date(r.iso).toLocaleString('en-IN').padEnd(21)} ${r.total.toFixed(2).padStart(8)}  ${r.payment.padEnd(8)} ${r.status.padEnd(9)} ${r.type}`);
      }
      doc.end();
      return;
    }

    // CSV / Excel(as CSV) / GST(as CSV) → inline stream.
    const csv = await reportsService.buildSalesCsv({ tenantId: req.tenantId, query: req.query });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report.csv"`);
    res.send(csv);
  }),
};
