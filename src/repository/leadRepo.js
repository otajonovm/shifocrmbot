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

  const normalizedStatus = String(status || '').trim();
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

module.exports = {
  extractLeadContact,
  getLeadById,
  updateLeadStatus,
  convertLeadToPatient,
};
