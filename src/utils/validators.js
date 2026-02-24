/**
 * Patient ID ni validatsiya qiladi
 * @param {string} patientId
 * @returns {boolean}
 */
function isValidPatientId(patientId) {
  if (!patientId || typeof patientId !== 'string') {
    return false;
  }
  // Faqat raqamlar va harflar (ShifoCRM patient_id formatiga mos)
  return /^[a-zA-Z0-9_-]+$/.test(patientId.trim());
}

/**
 * Telefon raqamni normalize qiladi va validatsiya qiladi
 * @param {string} phone
 * @returns {string|null} normalize qilingan telefon yoki null
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }
  // Faqat raqamlar va + ni qoldiradi
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.length < 9 || cleaned.length > 15) {
    return null;
  }
  // + bilan boshlanmasa, +998 qo'shadi (Uzbekistan)
  if (!cleaned.startsWith('+')) {
    return `+998${cleaned.replace(/^998/, '')}`;
  }
  return cleaned;
}

/**
 * Telefon raqamni validatsiya qiladi
 * @param {string} phone
 * @returns {boolean}
 */
function isValidPhone(phone) {
  return normalizePhone(phone) !== null;
}

module.exports = {
  isValidPatientId,
  normalizePhone,
  isValidPhone,
};
