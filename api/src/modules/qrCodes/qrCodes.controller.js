import PDFDocument from 'pdfkit';

import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';
import { qrPngBuffer } from '../../utils/qr.js';

import { qrCodesService } from './qrCodes.service.js';

export const qrCodesController = {
  list: asyncHandler(async (req, res) => {
    const branchId = req.query.branchId ?? req.query.branch;
    const { rows, total, stats } = await qrCodesService.list({
      tenantId: req.tenantId,
      query: { branchId, type: req.query.type, status: req.query.status },
    });
    res.json(ok(req, rows, { total, stats }));
  }),

  getById: asyncHandler(async (req, res) => {
    const qr = await qrCodesService.getById({ tenantId: req.tenantId, id: req.params.id });
    res.json(ok(req, qr));
  }),

  create: asyncHandler(async (req, res) => {
    const qr = await qrCodesService.create({ tenantId: req.tenantId, body: req.body, actor: req.user });
    res.status(201).json(ok(req, qr));
  }),

  update: asyncHandler(async (req, res) => {
    const qr = await qrCodesService.update({ tenantId: req.tenantId, id: req.params.id, body: req.body, actor: req.user });
    res.json(ok(req, qr));
  }),

  remove: asyncHandler(async (req, res) => {
    await qrCodesService.remove({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.status(204).end();
  }),

  regenerate: asyncHandler(async (req, res) => {
    const qr = await qrCodesService.regenerate({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.json(ok(req, qr));
  }),

  analytics: asyncHandler(async (req, res) => {
    const data = await qrCodesService.analytics({ tenantId: req.tenantId, id: req.params.id });
    res.json(ok(req, data));
  }),

  bulkPrint: asyncHandler(async (req, res) => {
    const rows = await qrCodesService.listForPrint({ tenantId: req.tenantId, query: req.body });

    const doc = new PDFDocument({ size: 'A4', margin: 48, autoFirstPage: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="vuedine-qr-codes.pdf"');
    doc.pipe(res);

    if (rows.length === 0) {
      doc.addPage();
      doc.fontSize(18).text('No QR codes to print.', { align: 'center' });
      doc.end();
      return;
    }

    for (const q of rows) {
      doc.addPage();
      // Header band
      doc.fontSize(20).fillColor('#0F172A').text('Vuedine', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(13).fillColor('#64748B').text(q.branch?.name ?? '', { align: 'center' });
      doc.moveDown(1.2);

      // QR image (centered)
      try {
        // eslint-disable-next-line no-await-in-loop
        const png = await qrPngBuffer(q.url);
        const size = 280;
        const x = (doc.page.width - size) / 2;
        doc.image(png, x, doc.y, { width: size, height: size });
        doc.moveDown(0.5);
        doc.y += size + 16;
      } catch {
        doc.fontSize(11).fillColor('#DC2626').text('QR render failed', { align: 'center' });
      }

      doc.fontSize(22).fillColor('#0F172A').text(q.label, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#94A3B8').text('Scan with your camera to view the menu', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(9).fillColor('#CBD5E1').text(q.url, { align: 'center' });
    }

    doc.end();
  }),
};
