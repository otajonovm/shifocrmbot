/**
 * ShifoCRM'dagi doktorlarni Supabase doctor_profiles jadvaliga avtomatik ko'chirish
 * 
 * Ishlatish:
 *   node src/scripts/syncDoctorsFromShifoCRM.js
 */

require('dotenv').config({ path: '.env' });

const supabase = require('../supabase');

// Telefon normallashtirish
function normalizePhone(phone) {
  if (!phone) return null;
  
  const cleaned = String(phone)
    .replace(/\D/g, '') // Barcha non-digit ni olib tashla
    .replace(/^7/, '998') // 7 bilan boshlansa, 998 ga almashtir (Rossiya kodidan)
    .trim();

  // Agar 998 bilan boshlansa
  if (cleaned.startsWith('998')) {
    return '+' + cleaned;
  }

  // Agar 12 xonali bo'lsa va 998 bilan boshlansa
  if (cleaned.length === 12 && !cleaned.startsWith('998')) {
    return '+998' + cleaned.slice(-9);
  }

  // Agar 9 xonali bo'lsa
  if (cleaned.length === 9) {
    return '+998' + cleaned;
  }

  // Agar allaqachon +998 formatida bo'lsa
  if (cleaned.startsWith('998')) {
    return '+' + cleaned;
  }

  return null;
}

async function syncDoctorsFromShifoCRM() {
  try {
    console.log('🔍 ShifoCRM doctors jadvalidan ma\'lumot o\'qilmoqda...');

    // ShifoCRM'dagi doctors jadvalidan o'qish
    const { data: doctors, error: doctorsError } = await supabase
      .from('doctors')
      .select('id, full_name, phone, email, specialization, created_at, updated_at')
      .eq('is_active', true)
      .limit(1000);

    if (doctorsError) {
      console.error('❌ ShifoCRM doctors jadvalini o\'qishda xatolik:', doctorsError);
      return { success: false, error: doctorsError };
    }

    if (!doctors || doctors.length === 0) {
      console.log('⚠️  ShifoCRM\'da hech qanday aktiv doktor topilmadi');
      return { success: true, imported: 0, skipped: 0 };
    }

    console.log(`✅ ${doctors.length} ta doktor topildi. Sinkronizatsiya boslanmoqda...`);

    let imported = 0;
    let skipped = 0;
    let errors = [];
    const processedPhones = new Set(); // Bu phoneni allaqachon qo'shgandimiz-mi?

    for (const doctor of doctors) {
      try {
        const normalizedPhone = normalizePhone(doctor.phone);

        if (!normalizedPhone) {
          console.log(`⏭️  Skipped (invalid phone): ${doctor.full_name} - ${doctor.phone}`);
          skipped++;
          continue;
        }

        // Agar bu telefon allaqachon shu cycle'da qo'shilgansa, skip qil
        if (processedPhones.has(normalizedPhone)) {
          console.log(`⏭️  Skipped (duplicate phone in cycle): ${doctor.full_name} (${normalizedPhone})`);
          skipped++;
          continue;
        }

        // Tekshirish: bu doktor allaqachon doctor_profiles'da bor mi?
        const { data: existing } = await supabase
          .from('doctor_profiles')
          .select('phone')
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (existing) {
          console.log(`ℹ️  Already exists: ${doctor.full_name} (${normalizedPhone})`);
          processedPhones.add(normalizedPhone); // Belgilash
          skipped++;
          continue;
        }

        // Yangi doctor profili yaratish
        const profilePayload = {
          phone: normalizedPhone,
          chat_id: null, // NULL - bot registratsiya paytida to'ldiriladi
          telegram_username: null,
          telegram_first_name: null,
          full_name: doctor.full_name || `Doctor ${doctor.id}`,
          role: 'doctor',
          notification_preference: 'all_appointments', // Default preference
          is_active: true,
          created_at: doctor.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: created, error: insertError } = await supabase
          .from('doctor_profiles')
          .insert([profilePayload])
          .select();

        if (insertError) {
          const errorMsg = `Error inserting ${doctor.full_name}: ${insertError.message}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
          skipped++;
          continue;
        }

        console.log(`✅ Imported: ${doctor.full_name} (${normalizedPhone})`);
        processedPhones.add(normalizedPhone); // Belgilash
        imported++;

      } catch (err) {
        const errorMsg = `Exception for ${doctor.full_name}: ${err?.message || String(err)}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
        skipped++;
      }
    }

    console.log('\n📊 NATIJA:');
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    if (errors.length > 0) {
      console.log(`   ❌ Errors: ${errors.length}`);
      errors.forEach((e) => console.log(`      - ${e}`));
    }

    return {
      success: true,
      imported,
      skipped,
      errors,
    };

  } catch (err) {
    console.error('❌ Sync exception:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

// Script ishga tushishi
if (require.main === module) {
  syncDoctorsFromShifoCRM()
    .then((result) => {
      console.log('\n✨ Sinkronizatsiya tugatildi.');
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { syncDoctorsFromShifoCRM, normalizePhone };
