import PDFDocument from 'pdfkit';

import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { serializeInvoice } from './billing.serializer.js';
import { billingService } from './billing.service.js';

export const billingController = {
  current: asyncHandler(async (req, res) => {
    const data = await billingService.getCurrent({ tenantId: req.tenantId, actor: req.user });
    res.json(ok(req, data));
  }),

  changePlan: asyncHandler(async (req, res) => {
    const data = await billingService.changePlan({
      tenantId: req.tenantId,
      planSlug: req.body.planSlug,
      cycle: req.body.cycle,
      actor: req.user,
    });
    res.json(ok(req, data));
  }),

  cancel: asyncHandler(async (req, res) => {
    const data = await billingService.cancel({ tenantId: req.tenantId, actor: req.user });
    res.json(ok(req, data));
  }),

  resume: asyncHandler(async (req, res) => {
    const data = await billingService.resume({ tenantId: req.tenantId, actor: req.user });
    res.json(ok(req, data));
  }),

  toggleAddon: asyncHandler(async (req, res) => {
    const data = await billingService.toggleAddon({
      tenantId: req.tenantId,
      addonId: req.params.id,
      actor: req.user,
    });
    res.json(ok(req, data));
  }),

  listInvoices: asyncHandler(async (req, res) => {
    const data = await billingService.listInvoices({ tenantId: req.tenantId });
    res.json(ok(req, data));
  }),

  getInvoice: asyncHandler(async (req, res) => {
    const inv = await billingService.getInvoice({ tenantId: req.tenantId, id: req.params.id });
    res.json(ok(req, serializeInvoice(inv)));
  }),

  downloadInvoice: asyncHandler(async (req, res) => {
    const inv = await billingService.getInvoice({ tenantId: req.tenantId, id: req.params.id });
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inv.number}.pdf"`);
    doc.pipe(res);

    doc.fontSize(22).fillColor('#EC1B7C').text('Vuedine', { continued: false });
    doc.fontSize(10).fillColor('#64748B').text('Tax Invoice', { align: 'left' });
    doc.moveDown(1);
    doc.fontSize(16).fillColor('#0F172A').text(inv.number);
    doc.fontSize(10).fillColor('#64748B').text(`Period: ${inv.period}`);
    doc.text(`Issued: ${new Date(inv.issuedAt).toLocaleDateString('en-IN')}`);
    doc.text(`Due: ${new Date(inv.dueAt).toLocaleDateString('en-IN')}`);
    doc.text(`Status: ${inv.status}`);
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#E2E8F0');
    doc.moveDown(0.5);

    const amount = Number(inv.amount);
    const tax = Number(inv.taxAmount);
    doc.fontSize(11).fillColor('#0F172A');
    doc.text(`Subscription charge:  Rs. ${amount.toFixed(2)}`);
    doc.text(`GST (18%):            Rs. ${tax.toFixed(2)}`);
    doc.moveDown(0.3);
    doc.fontSize(13).fillColor('#0F172A').text(`Total:               Rs. ${(amount + tax).toFixed(2)}`);
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#94A3B8').text('Thank you for building with Vuedine.', { align: 'center' });
    doc.end();
  }),
};
