<!--
  ShifoCRM: PaymentsView.vue (yoki to'lov modal) uchun cashback UI snippet.
  Loyihangizdagi modalga moslashtiring.

  Kerakli import:
  import {
    getCashbackBalance,
    applyPaymentCashback,
  } from '@/api/cashbackApi' // yoki telegramApi.js dan
-->

<script setup>
import { ref, computed, watch } from 'vue'
import { getCashbackBalance, applyPaymentCashback } from '@/api/cashbackApi'

const props = defineProps({
  patientId: { type: [String, Number], required: true },
  paymentAmount: { type: Number, required: true },
})

const cashbackBalance = ref(0)
const useCashback = ref(false)
const cashbackToSpend = ref(0)
const loadingBalance = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const maxSpendable = computed(() => {
  const amount = Number(props.paymentAmount) || 0
  const balance = Number(cashbackBalance.value) || 0
  return Math.min(amount, balance)
})

const cashToPay = computed(() => {
  if (!useCashback.value) return Number(props.paymentAmount) || 0
  return Math.max(0, (Number(props.paymentAmount) || 0) - (Number(cashbackToSpend.value) || 0))
})

async function loadBalance() {
  if (!props.patientId) return
  loadingBalance.value = true
  errorMessage.value = ''
  try {
    const result = await getCashbackBalance(props.patientId)
    if (result.ok) {
      cashbackBalance.value = Number(result.balance) || 0
    } else {
      cashbackBalance.value = 0
      errorMessage.value = result.error || 'Balans yuklanmadi'
    }
  } catch (err) {
    cashbackBalance.value = 0
    errorMessage.value = err?.message || 'Balans xatosi'
  } finally {
    loadingBalance.value = false
  }
}

watch(
  () => props.patientId,
  () => {
    useCashback.value = false
    cashbackToSpend.value = 0
    loadBalance()
  },
  { immediate: true }
)

watch(useCashback, (enabled) => {
  if (!enabled) {
    cashbackToSpend.value = 0
    return
  }
  cashbackToSpend.value = maxSpendable.value
})

watch(cashbackToSpend, (value) => {
  const max = maxSpendable.value
  if (Number(value) > max) {
    cashbackToSpend.value = max
  }
  if (Number(value) < 0) {
    cashbackToSpend.value = 0
  }
})

/**
 * To'lov saqlangach chaqiring (visitsApi / payments save dan keyin)
 * @param {string|number} paymentId - saqlangan to'lov ID
 */
async function onPaymentSaved(paymentId) {
  saving.value = true
  errorMessage.value = ''
  try {
    const result = await applyPaymentCashback({
      patientId: props.patientId,
      paymentId,
      totalAmount: props.paymentAmount,
      cashbackUsed: useCashback.value ? cashbackToSpend.value : 0,
    })

    if (!result.ok) {
      errorMessage.value =
        result.spend?.message ||
        result.earn?.message ||
        result.error ||
        'Keshbek amaliyoti muvaffaqiyatsiz'
      return { ok: false, result }
    }

    await loadBalance()
    return { ok: true, result }
  } catch (err) {
    errorMessage.value = err?.message || 'Keshbek xatosi'
    return { ok: false, error: errorMessage.value }
  } finally {
    saving.value = false
  }
}

defineExpose({ onPaymentSaved, loadBalance, cashToPay, cashbackToSpend, useCashback })
</script>

<template>
  <div class="cashback-block">
    <div class="cashback-balance">
      <span>💰 Keshbek balansi:</span>
      <strong v-if="!loadingBalance">
        {{ Number(cashbackBalance).toLocaleString('uz-UZ') }} so'm
      </strong>
      <span v-else>…</span>
    </div>

    <label class="cashback-toggle">
      <input v-model="useCashback" type="checkbox" :disabled="maxSpendable <= 0" />
      Keshbekdan to'lash
    </label>

    <div v-if="useCashback" class="cashback-spend">
      <label>Yechiladigan summa (max {{ maxSpendable.toLocaleString('uz-UZ') }})</label>
      <input
        v-model.number="cashbackToSpend"
        type="number"
        min="0"
        :max="maxSpendable"
        step="1000"
      />
    </div>

    <div class="cashback-summary">
      Naqd / karta: <strong>{{ cashToPay.toLocaleString('uz-UZ') }} so'm</strong>
      <template v-if="useCashback && cashbackToSpend > 0">
        · Keshbek: −{{ Number(cashbackToSpend).toLocaleString('uz-UZ') }} so'm
      </template>
    </div>

    <p v-if="errorMessage" class="cashback-error">{{ errorMessage }}</p>
  </div>
</template>
