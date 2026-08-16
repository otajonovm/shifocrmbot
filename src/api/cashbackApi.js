const express = require('express');
const cashbackService = require('../services/cashbackService');
const cashbackRepo = require('../repository/cashbackRepo');

function createCashbackApi(bot) {
  const router = express.Router();

  router.get('/balance/:patientId', async (req, res) => {
    try {
      const patientId = String(req.params.patientId || '').trim();
      if (!patientId) {
        return res.status(400).json({ ok: false, error: 'PATIENT_ID_REQUIRED' });
      }

      const summary = await cashbackService.getPatientCashbackSummary(patientId);
      return res.json({ ok: true, ...summary });
    } catch (err) {
      console.error('Cashback balance error:', err);
      return res.status(500).json({
        ok: false,
        error: 'CASHBACK_BALANCE_FAILED',
        message: err?.message || String(err),
      });
    }
  });

  /**
   * POST /api/cashback/earn
   * body: { patient_id, payment_amount, payment_id?, cashback_percent?, notify? }
   */
  router.post('/earn', async (req, res) => {
    try {
      const {
        patient_id: patientId,
        payment_amount: paymentAmount,
        payment_id: paymentId,
        cashback_percent: cashbackPercent,
        notify = true,
        metadata,
      } = req.body || {};

      const result = await cashbackService.earnCashback({
        bot,
        patientId,
        paymentAmount,
        paymentId,
        cashbackPercent,
        notify: notify !== false,
        metadata: metadata || {},
      });

      return res.json(result);
    } catch (err) {
      console.error('Cashback earn error:', err);
      const status = err?.code === 'VALIDATION_ERROR' ? 400 : 500;
      return res.status(status).json({
        ok: false,
        error: err?.code || 'CASHBACK_EARN_FAILED',
        message: err?.message || String(err),
      });
    }
  });

  /**
   * POST /api/cashback/spend
   * body: { patient_id, amount, payment_id?, notify? }
   */
  router.post('/spend', async (req, res) => {
    try {
      const {
        patient_id: patientId,
        amount,
        payment_id: paymentId,
        notify = true,
        metadata,
      } = req.body || {};

      const result = await cashbackService.spendCashback({
        bot,
        patientId,
        amount,
        paymentId,
        notify: notify !== false,
        metadata: metadata || {},
      });

      return res.json(result);
    } catch (err) {
      console.error('Cashback spend error:', err);
      if (err?.code === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({
          ok: false,
          error: 'INSUFFICIENT_BALANCE',
          balance: err.balance || null,
          message: 'Keshbek balansi yetarli emas',
        });
      }

      const status = err?.code === 'VALIDATION_ERROR' ? 400 : 500;
      return res.status(status).json({
        ok: false,
        error: err?.code || 'CASHBACK_SPEND_FAILED',
        message: err?.message || String(err),
      });
    }
  });

  router.get('/config', (_req, res) => {
    res.json({
      ok: true,
      cashback_percent: cashbackService.CASHBACK_PERCENT,
      referral_bonus_amount: cashbackRepo.toMoney(cashbackService.REFERRAL_BONUS_AMOUNT),
      bot_username: cashbackService.BOT_USERNAME || null,
    });
  });

  return router;
}

module.exports = createCashbackApi;
