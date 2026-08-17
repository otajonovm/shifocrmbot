const supabase = require('../supabase');

function toMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.round(num * 100) / 100;
}

function isMissingTableError(error) {
  const msg = String(error?.message || error?.details || '').toLowerCase();
  const code = String(error?.code || '');
  return (
    code === 'PGRST205'
    || code === '42P01'
    || ((msg.includes('does not exist') || msg.includes('could not find the table') || msg.includes('schema cache'))
      && (msg.includes('patient_cashback') || msg.includes('patient_referrals') || msg.includes('cashback_transactions')))
  );
}

function isPermissionError(error) {
  const msg = String(error?.message || error?.details || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42501' || msg.includes('permission denied') || msg.includes('row-level security');
}

function emptyBalance(patientId) {
  return {
    patient_id: String(patientId),
    balance: 0,
    lifetime_earned: 0,
    lifetime_spent: 0,
  };
}

async function getOrCreateBalance(patientId) {
  const id = String(patientId);
  const { data, error } = await supabase
    .from('patient_cashback_balances')
    .select('*')
    .eq('patient_id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const { data: created, error: insertError } = await supabase
    .from('patient_cashback_balances')
    .insert({
      patient_id: id,
      balance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
    })
    .select('*')
    .single();

  if (insertError) {
    // Race: boshqa process yaratgan bo'lishi mumkin
    const { data: existing, error: reloadError } = await supabase
      .from('patient_cashback_balances')
      .select('*')
      .eq('patient_id', id)
      .maybeSingle();

    if (reloadError || !existing) {
      throw insertError;
    }
    return existing;
  }

  return created;
}

async function getBalance(patientId) {
  try {
    const row = await getOrCreateBalance(patientId);
    return {
      patient_id: String(row.patient_id),
      balance: toMoney(row.balance),
      lifetime_earned: toMoney(row.lifetime_earned),
      lifetime_spent: toMoney(row.lifetime_spent),
      setup_required: false,
    };
  } catch (error) {
    console.error('❌ Cashback getBalance xatolik:', error?.code || '', error?.message || error);
    if (isMissingTableError(error)) {
      return { ...emptyBalance(patientId), setup_required: true, setup_reason: 'TABLES_MISSING' };
    }
    if (isPermissionError(error)) {
      return { ...emptyBalance(patientId), setup_required: true, setup_reason: 'PERMISSION_DENIED' };
    }
    throw error;
  }
}

async function findTransactionByPayment({ patientId, paymentId, type }) {
  if (!paymentId) {
    return null;
  }

  const { data, error } = await supabase
    .from('cashback_transactions')
    .select('*')
    .eq('patient_id', String(patientId))
    .eq('payment_id', String(paymentId))
    .eq('type', type)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function applyBalanceChange({
  patientId,
  type,
  amount,
  paymentId = null,
  paymentAmount = null,
  relatedPatientId = null,
  note = null,
  metadata = {},
}) {
  const money = toMoney(amount);
  if (money <= 0) {
    throw new Error('AMOUNT_MUST_BE_POSITIVE');
  }

  if (paymentId) {
    const existing = await findTransactionByPayment({
      patientId,
      paymentId,
      type,
    });
    if (existing) {
      const balance = await getBalance(patientId);
      return {
        ok: true,
        duplicate: true,
        transaction: existing,
        balance,
      };
    }
  }

  const current = await getOrCreateBalance(patientId);
  const currentBalance = toMoney(current.balance);
  let nextBalance = currentBalance;
  let lifetimeEarned = toMoney(current.lifetime_earned);
  let lifetimeSpent = toMoney(current.lifetime_spent);

  if (type === 'earn' || type === 'referral_bonus' || type === 'adjust') {
    nextBalance = toMoney(currentBalance + money);
    lifetimeEarned = toMoney(lifetimeEarned + money);
  } else if (type === 'spend') {
    if (money > currentBalance) {
      const err = new Error('INSUFFICIENT_BALANCE');
      err.code = 'INSUFFICIENT_BALANCE';
      err.balance = currentBalance;
      throw err;
    }
    nextBalance = toMoney(currentBalance - money);
    lifetimeSpent = toMoney(lifetimeSpent + money);
  } else {
    throw new Error(`UNKNOWN_TRANSACTION_TYPE:${type}`);
  }

  const { data: updated, error: updateError } = await supabase
    .from('patient_cashback_balances')
    .update({
      balance: nextBalance,
      lifetime_earned: lifetimeEarned,
      lifetime_spent: lifetimeSpent,
    })
    .eq('patient_id', String(patientId))
    .select('*')
    .single();

  if (updateError) {
    throw updateError;
  }

  const { data: tx, error: txError } = await supabase
    .from('cashback_transactions')
    .insert({
      patient_id: String(patientId),
      type,
      amount: money,
      balance_after: nextBalance,
      payment_id: paymentId ? String(paymentId) : null,
      payment_amount: paymentAmount != null ? toMoney(paymentAmount) : null,
      related_patient_id: relatedPatientId ? String(relatedPatientId) : null,
      note,
      metadata: metadata || {},
    })
    .select('*')
    .single();

  if (txError) {
    // Unique conflict — duplicate payment
    if (String(txError.code) === '23505' || String(txError.message || '').includes('duplicate')) {
      const existing = await findTransactionByPayment({
        patientId,
        paymentId,
        type,
      });
      const balance = await getBalance(patientId);
      return {
        ok: true,
        duplicate: true,
        transaction: existing,
        balance,
      };
    }
    throw txError;
  }

  return {
    ok: true,
    duplicate: false,
    transaction: tx,
    balance: {
      patient_id: String(updated.patient_id),
      balance: toMoney(updated.balance),
      lifetime_earned: toMoney(updated.lifetime_earned),
      lifetime_spent: toMoney(updated.lifetime_spent),
    },
  };
}

async function getReferralByReferred(referredPatientId) {
  const { data, error } = await supabase
    .from('patient_referrals')
    .select('*')
    .eq('referred_patient_id', String(referredPatientId))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function createReferralLink({
  referrerPatientId,
  referredPatientId,
  referredChatId = null,
  bonusAmount = 0,
}) {
  const existing = await getReferralByReferred(referredPatientId);
  if (existing) {
    return { ok: true, duplicate: true, referral: existing };
  }

  if (String(referrerPatientId) === String(referredPatientId)) {
    const err = new Error('SELF_REFERRAL_NOT_ALLOWED');
    err.code = 'SELF_REFERRAL_NOT_ALLOWED';
    throw err;
  }

  const { data, error } = await supabase
    .from('patient_referrals')
    .insert({
      referrer_patient_id: String(referrerPatientId),
      referred_patient_id: String(referredPatientId),
      referred_chat_id: referredChatId ? String(referredChatId) : null,
      bonus_amount: toMoney(bonusAmount),
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    if (String(error.code) === '23505') {
      const again = await getReferralByReferred(referredPatientId);
      return { ok: true, duplicate: true, referral: again };
    }
    throw error;
  }

  return { ok: true, duplicate: false, referral: data };
}

async function markReferralBonusPaid(referralId) {
  const { data, error } = await supabase
    .from('patient_referrals')
    .update({
      status: 'bonus_paid',
      rewarded_at: new Date().toISOString(),
    })
    .eq('id', referralId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function countReferrals(referrerPatientId) {
  try {
    const { count, error } = await supabase
      .from('patient_referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_patient_id', String(referrerPatientId));

    if (error) {
      if (isMissingTableError(error) || isPermissionError(error)) {
        return 0;
      }
      throw error;
    }

    return count || 0;
  } catch (error) {
    if (isMissingTableError(error) || isPermissionError(error)) {
      return 0;
    }
    throw error;
  }
}

module.exports = {
  applyBalanceChange,
  countReferrals,
  createReferralLink,
  emptyBalance,
  findTransactionByPayment,
  getBalance,
  getOrCreateBalance,
  getReferralByReferred,
  isMissingTableError,
  isPermissionError,
  markReferralBonusPaid,
  toMoney,
};
