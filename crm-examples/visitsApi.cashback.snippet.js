/**
 * ShifoCRM visitsApi.js / payments saqlash oqimiga qo'shish uchun namuna.
 *
 * To'lov muvaffaqiyatli saqlangach:
 *   await applyPaymentCashback({ patientId, paymentId, totalAmount, cashbackUsed })
 */

import { applyPaymentCashback, getCashbackBalance } from '@/api/cashbackApi'

/**
 * @param {object} payment
 * @param {string|number} payment.patientId
 * @param {string|number} payment.id - DB dagi payment id
 * @param {number} payment.amount - to'lov summasi
 * @param {number} [payment.cashbackUsed] - keshbekdan yechilgan summa
 */
export async function afterPaymentSaved(payment) {
  try {
    const result = await applyPaymentCashback({
      patientId: payment.patientId,
      paymentId: payment.id,
      totalAmount: payment.amount,
      cashbackUsed: payment.cashbackUsed || 0,
    })

    if (!result.ok) {
      console.warn('[cashback] amaliyot xatosi:', result)
      return result
    }

    return result
  } catch (error) {
    console.error('[cashback] exception:', error)
    return { ok: false, error: error?.message || 'CASHBACK_EXCEPTION' }
  }
}

export async function fetchPatientCashback(patientId) {
  try {
    return await getCashbackBalance(patientId)
  } catch (error) {
    return { ok: false, error: error?.message || 'BALANCE_EXCEPTION', balance: 0 }
  }
}

/*
  PaymentsView.vue ichida taxminiy ishlatish:

  async function savePayment() {
    const saved = await createPayment({ ...payload, cashback_used: cashbackToSpend.value })
    if (!saved?.id) return

    await afterPaymentSaved({
      id: saved.id,
      patientId: selectedPatient.id,
      amount: paymentAmount.value,
      cashbackUsed: useCashback.value ? cashbackToSpend.value : 0,
    })
  }
*/
