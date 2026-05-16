const cron = require('node-cron');
const supabase = require('../supabase');
const { getDoctorByPhone } = require('../repository/doctorProfileRepo');
const { enqueueDoctorReminderEvent } = require('./doctorReminderService');

function getTodayString() {
  // O'zbekiston vaqti bilan bugungi sanani (YYYY-MM-DD) qaytaradi
  const now = new Date();
  now.setUTCHours(now.getUTCHours() + 5); // +05:00 UZT
  return now.toISOString().split('T')[0];
}

async function getDoctorVisits(doctorId, date) {
  const { data, error } = await supabase
    .from('visits')
    .select('id, start_time, status')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .in('status', ['pending', 'confirmed', 'in_progress', 'completed_paid', 'completed_unpaid']); 

  if (error) {
    console.error(`❌ getDoctorVisits xatolik [doctor_id: ${doctorId}]:`, error);
    return [];
  }
  return data || [];
}

async function getAllActiveDoctorsWithChats() {
  const { data: dbDoctors, error: docError } = await supabase
    .from('doctors')
    .select('id, phone, full_name');
  
  if (docError) {
    console.error('❌ doctors table dan o\'qib bo\'lmadi:', docError);
    return [];
  }

  const { data: profiles, error: profError } = await supabase
    .from('doctor_profiles')
    .select('phone, chat_id, notification_preference')
    .not('chat_id', 'is', null);

  if (profError) {
    console.error('❌ doctor_profiles table dan o\'qib bo\'lmadi:', profError);
    return [];
  }

  const activeDoctors = [];
  for (const doc of dbDoctors) {
    if (!doc.phone) continue;
    const profile = profiles.find(p => p.phone === doc.phone);
    if (profile && profile.chat_id) {
      activeDoctors.push({
        id: doc.id,
        phone: doc.phone,
        fullName: doc.full_name,
        chatId: profile.chat_id,
        preference: profile.notification_preference
      });
    }
  }

  return activeDoctors;
}

// Ertalab soat 07:30 da tushlikkacha bo'lgan qabullar
async function sendMorningSummary() {
  console.log('🌅 Morning summary ishga tushdi...');
  const today = getTodayString();
  const doctors = await getAllActiveDoctorsWithChats();

  for (const doc of doctors) {
    const visits = await getDoctorVisits(doc.id, today);
    const morningVisits = visits.filter(v => v.start_time && v.start_time < '13:00:00');
    
    // Agar qabul bo'lmasa ham jo'natsak bo'ladi yoki faqat qabuli borlarga:
    const count = morningVisits.length;
    let text = `☀️ Xayrli tong, ${doc.fullName}!\n\n`;
    
    if (count > 0) {
      text += `Bugun tushlikgacha (13:00 gacha) sizda ${count} ta qabul belgilangan.`;
    } else {
      text += `Bugun tushlikgacha hozircha qabullar ko'rinmayapti.`;
    }

    await enqueueDoctorReminderEvent({
      doctorPhone: doc.phone,
      eventType: 'daily_summary',
      title: 'Erta tonggi xisobot',
      message: text,
      scheduledTime: new Date().toISOString(),
      metadata: { priority: 'normal', summaryType: 'morning' }
    });
  }
}

// Tushlik soat 12:30 da kechgacha bo'lgan qabullar
async function sendAfternoonSummary() {
  console.log('☀️ Afternoon summary ishga tushdi...');
  const today = getTodayString();
  const doctors = await getAllActiveDoctorsWithChats();

  for (const doc of doctors) {
    const visits = await getDoctorVisits(doc.id, today);
    const afternoonVisits = visits.filter(v => v.start_time && v.start_time >= '13:00:00');
    
    const count = afternoonVisits.length;
    let text = `🍝 Xayrli kun, ${doc.fullName}!\n\n`;
    
    if (count > 0) {
      text += `Tushlikdan keyin sizda ${count} ta qabul kutilmoqda.`;
    } else {
      text += `Tushlikdan keyin hozircha qabullar yo'q.`;
    }

    await enqueueDoctorReminderEvent({
      doctorPhone: doc.phone,
      eventType: 'daily_summary',
      title: 'Tushlik xisoboti',
      message: text,
      scheduledTime: new Date().toISOString(),
      metadata: { priority: 'normal', summaryType: 'afternoon' }
    });
  }
}

// Kechki soat 19:30 da so'rovnoma
async function sendEveningSummary() {
  console.log('🌙 Evening summary ishga tushdi...');
  const doctors = await getAllActiveDoctorsWithChats();

  for (const doc of doctors) {
    let text = `🌙 Xayrli kech, ${doc.fullName}!\n\nBugungi ish kuningiz qanday o'tdi? Barcha qabul qilingan bemorlar tizimga to'liq kiritildimi?`;

    await enqueueDoctorReminderEvent({
      doctorPhone: doc.phone,
      eventType: 'daily_summary',
      title: 'Kechki so\'rovnoma',
      message: text,
      scheduledTime: new Date().toISOString(),
      metadata: { priority: 'normal', summaryType: 'evening' },
      actions: [
        { text: 'To\'liq kiritdim', actionKey: 'done' },
        { text: 'Ertaga kiritaman', actionKey: 'later' }
      ]
    });
  }
}

function initDailySummaries() {
  console.log('✅ Daily summaries cron jobs o\'rnatildi!');
  
  // Har kuni soat 07:30 da (Server UTC da bo'lsa, O'zbekiston bilan farqini inobatga olish kerak)
  // Ammo odatda cron lokal vaqt bo'yicha yoki timezone bilan beriladi.
  // node-cron'da timezone: 'Asia/Tashkent' qilish mumkin.
  
  cron.schedule('30 7 * * *', sendMorningSummary, {
    scheduled: true,
    timezone: "Asia/Tashkent"
  });

  cron.schedule('30 12 * * *', sendAfternoonSummary, {
    scheduled: true,
    timezone: "Asia/Tashkent"
  });

  cron.schedule('30 19 * * *', sendEveningSummary, {
    scheduled: true,
    timezone: "Asia/Tashkent"
  });
}

module.exports = {
  initDailySummaries,
  sendMorningSummary,
  sendAfternoonSummary,
  sendEveningSummary
};