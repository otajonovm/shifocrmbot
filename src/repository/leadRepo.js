const supabase = require('../supabase');

const PHONE_FIELD_CANDIDATES = [
  'phone',
  'phone_number',
  'mobile',
  'phone_no',
  'telephone',
  'tel',
  'contact_phone',
  'phone1',
  'phone_1',
  'phone2',
  'phone_2',
  'primary_phone',
  'secondary_phone',
  'mobile_phone',
  'cell_phone',
  'contact',
  'contact_number',
  'contact_phone_number',
  'phone_number_1',
  'phone_number_2',
  'client_phone',
  'client_phone_number',
  'lead_phone',
  'lead_phone_number',
];

const NAME_FIELD_CANDIDATES = [
  'full_name',
  'name',
  'patient_name',
  'lead_name',
  'client_name',
];

const CANONICAL_LEAD_STATUSES = {
  yangi: 'Yangi',
  boglangan: "Bog'langan",
  'bog\'langan': "Bog'langan",
  bandqilingan: 'Band qilingan',
  'band qilingan': 'Band qilingan',
  booked: 'Band qilingan',
  qabulda: 'Qabulda',
  radetilgan: 'Rad etilgan',
  'rad etilgan': 'Rad etilgan',
  rejected: 'Rad etilgan',
};

function pickFirst(row, fieldNames) {
  for (const field of fieldNames) {
    if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
      return row[field];
    }
  }
  return null;
}

function extractLeadContact(leadRow) {
  if (!leadRow) {
    return { phone: null, name: null };
  }

  return {
    phone: pickFirst(leadRow, PHONE_FIELD_CANDIDATES),
    name: pickFirst(leadRow, NAME_FIELD_CANDIDATES),
  };
}

function normalizeLeadStatus(status) {
  const rawStatus = String(status || '').trim();
  if (!rawStatus) {
    return '';
  }

  const key = rawStatus
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const compactKey = key.replace(/\s+/g, '');

  return CANONICAL_LEAD_STATUSES[key]
    || CANONICAL_LEAD_STATUSES[compactKey]
    || rawStatus;
}

async function getLeadById(leadId) {
  if (!leadId) {
    return null;
  }

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();

  if (error) {
    console.error('❌ lead qidirishda xatolik:', error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  return { ...data, _table: 'leads' };
}

async function updateLeadStatus(leadId, status) {
  if (!leadId) {
    return { success: false, message: 'Lead ID yo\'q' };
  }

  const normalizedStatus = normalizeLeadStatus(status);
  if (!normalizedStatus) {
    return { success: false, message: 'Status bo\'sh' };
  }

  try {
    const lead = await getLeadById(leadId);
    if (!lead) {
      return { success: false, message: `Lead ${leadId} topilmadi` };
    }

    const leadContact = extractLeadContact(lead);
    console.log(
      `🔄 Lead status yangilanmoqda: ID=${leadId}, name=${leadContact.name || "Noma'lum"}, phone=${leadContact.phone || "Noma'lum"}, status=${normalizedStatus}`
    );

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        status: normalizedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    if (updateError) {
      console.error('❌ Lead status yangilashda xatolik:', updateError.message);
      return { success: false, message: `Lead status yangilashda xatolik: ${updateError.message}` };
    }

    console.log(`✅ Lead status yangilandi: ID=${leadId} -> ${normalizedStatus}`);

    return {
      success: true,
      message: `Lead ${leadId} statusi ${normalizedStatus} ga o'zgartirildi`,
      leadData: lead,
    };
  } catch (err) {
    console.error('❌ Lead status update exception:', err);
    return { success: false, message: `Exception: ${err.message || err}` };
  }
}

/**
 * Lead'ni band qilingan holatiga o'tkazish
 * @param {string|number} leadId
 * @returns {Promise<{success: boolean, message: string, leadData?: Object}>}
 */
async function convertLeadToPatient(leadId) {
  return updateLeadStatus(leadId, 'Band qilingan');
}

const OPEN_LEAD_STATUS_TOKENS = [
  'hold',
  'new',
  'yangi',
  'contacted',
  'bog',
  'pending',
  'open',
];

function isOpenLeadStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (!normalized) {
    return true;
  }

  if (['expired', 'cancel', 'closed', 'archived', 'rejected', 'rad'].some((token) => normalized.includes(token))) {
    return false;
  }

  return OPEN_LEAD_STATUS_TOKENS.some((token) => normalized.includes(token));
}

async function linkLeadToTelegram(leadId, { patientId, chatId }) {
  if (!leadId || !patientId) {
    return { success: false, message: 'leadId yoki patientId yo\'q' };
  }

  const lead = await getLeadById(leadId);
  if (!lead) {
    return { success: false, message: `Lead ${leadId} topilmadi` };
  }

  const payloads = [
    {
      patient_id: String(patientId),
      telegram_linked_at: new Date().toISOString(),
      telegram_chat_id: chatId ? String(chatId) : undefined,
      status: isOpenLeadStatus(lead.status) ? (normalizeLeadStatus("Bog'langan") || "Bog'langan") : undefined,
      updated_at: new Date().toISOString(),
    },
    {
      patient_id: String(patientId),
      updated_at: new Date().toISOString(),
    },
  ];

  for (const rawPayload of payloads) {
    const payload = Object.fromEntries(
      Object.entries(rawPayload).filter(([, value]) => value !== undefined)
    );

    const { error } = await supabase
      .from('leads')
      .update(payload)
      .eq('id', leadId);

    if (!error) {
      console.log(`✅ Lead telegram bilan bog'landi: leadId=${leadId}, patientId=${patientId}`);
      return { success: true, leadId, patientId };
    }

    if (payloads.indexOf(rawPayload) === payloads.length - 1) {
      console.error('❌ Lead telegram bog\'lashda xatolik:', error.message);
      return { success: false, message: error.message };
    }
  }

  return { success: false, message: 'Lead yangilash muvaffaqiyatsiz' };
}

async function findOpenLeadsByPhone(phone) {
  if (!phone) {
    return [];
  }

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('⚠️ Open leads qidirishda xatolik:', error.message);
    return [];
  }

  const digits = String(phone).replace(/\D/g, '');
  const last9 = digits.slice(-9);

  return (data || []).filter((row) => {
    if (!isOpenLeadStatus(row.status)) {
      return false;
    }

    const rowPhone = pickFirst(row, PHONE_FIELD_CANDIDATES);
    if (!rowPhone) {
      return false;
    }

    const rowDigits = String(rowPhone).replace(/\D/g, '');
    return rowDigits === digits || (last9.length >= 9 && rowDigits.endsWith(last9));
  });
}

async function linkOpenLeadsForPatient({ patientId, phone, chatId, preferredLeadId = null }) {
  const linked = [];

  if (preferredLeadId) {
    const result = await linkLeadToTelegram(preferredLeadId, { patientId, chatId });
    if (result.success) {
      linked.push(preferredLeadId);
    }
  }

  const openLeads = await findOpenLeadsByPhone(phone);
  for (const lead of openLeads) {
    const leadId = String(lead.id);
    if (linked.includes(leadId)) {
      continue;
    }

    const result = await linkLeadToTelegram(leadId, { patientId, chatId });
    if (result.success) {
      linked.push(leadId);
    }
  }

  return linked;
}

module.exports = {
  extractLeadContact,
  getLeadById,
  updateLeadStatus,
  convertLeadToPatient,
  linkLeadToTelegram,
  findOpenLeadsByPhone,
  linkOpenLeadsForPatient,
  isOpenLeadStatus,
};
