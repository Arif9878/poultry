<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import EmptyState from "../components/EmptyState.vue";
import MetricCard from "../components/MetricCard.vue";
import { useAuth } from "../composables/useAuth";
import { dataVersion } from "../lib/appState";
import {
  createFeedItem,
  createFeedPurchase,
  createFeedSupplier,
  createFeedTransaction,
  getFeedSummaryByFarm,
  listFeedItemsByFarm,
  listFeedPurchasesByFarm,
  listFeedSuppliersByFarm,
  listFeedTransactionsByFarm,
  listFeedUsageHistoryByFarm,
  normalizeFeedItemPrice,
  normalizeFeedTotalCost,
  normalizeFeedUnitCost,
} from "../services/feed.service";
import { listAccessibleFarms } from "../services/farms.service";
import type {
  Farm,
  FeedItem,
  FeedPurchase,
  FeedSummary,
  FeedSupplier,
  FeedTransaction,
  FeedUsageHistoryRow,
} from "../types/models";
import { downloadCsv } from "../utils/exportCsv";
import { getTodayDate } from "../utils/formatDate";
import {
  formatCurrency,
  formatDecimal,
  formatNumber,
} from "../utils/formatNumber";

const route = useRoute();
const { profile } = useAuth();

const farms = ref<Farm[]>([]);
const selectedFarmId = ref("");
const items = ref<FeedItem[]>([]);
const suppliers = ref<FeedSupplier[]>([]);
const purchases = ref<FeedPurchase[]>([]);
const transactions = ref<FeedTransaction[]>([]);
const usageHistory = ref<FeedUsageHistoryRow[]>([]);
const summary = ref<FeedSummary>({
  totalStockKg: 0,
  grossStockKg: 0,
  lowStockCount: 0,
  totalItems: 0,
  averageFeedPricePerKgRp: 0,
  totalUsedTodayKg: 0,
  averageDailyUsageKg: 0,
  averageFeedPerBirdKg: null,
  estimatedStockDays: null,
  stockStatus: "aman",
});
const loading = ref(false);
const error = ref("");

const itemForm = reactive({
  name: "",
  brand: "",
  unit: "kg",
  pricePerKgRp: 7500,
  openingStockKg: 0,
  openingStockTotalCostRp: null as number | null,
  reorderLevelKg: 250,
  notes: "",
});

const transactionForm = reactive({
  feedItemId: "",
  transactionType: "in" as const,
  quantityKg: 0,
  totalCostRp: null as number | null,
  transactionDate: getTodayDate(),
  notes: "",
});

const supplierForm = reactive({
  name: "",
  contactName: "",
  phone: "",
  paymentTermDays: 14,
  notes: "",
});

const purchaseForm = reactive({
  supplierId: "",
  feedItemId: "",
  invoiceNumber: "",
  purchaseDate: getTodayDate(),
  quantityKg: 0,
  totalCostRp: 0,
  paymentDueDate: "",
  notes: "",
});

const canManage = computed(() => profile.value?.role !== "operator");
const selectedFeedItem = computed(
  () =>
    items.value.find((item) => item.id === transactionForm.feedItemId) ?? null,
);
const effectiveUnitCost = computed(() => {
  if (transactionForm.totalCostRp !== null && transactionForm.quantityKg > 0) {
    return transactionForm.totalCostRp / transactionForm.quantityKg;
  }

  return selectedFeedItem.value
    ? normalizeFeedItemPrice(
        selectedFeedItem.value.price_per_kg_rp,
        selectedFeedItem.value.opening_stock_kg,
      )
    : null;
});
const estimatedTotalCost = computed(() => {
  if (transactionForm.totalCostRp !== null) {
    return transactionForm.totalCostRp;
  }

  if (effectiveUnitCost.value !== null && transactionForm.quantityKg > 0) {
    return effectiveUnitCost.value * transactionForm.quantityKg;
  }

  return null;
});
const effectiveOpeningPricePerKg = computed(() => {
  if (itemForm.openingStockTotalCostRp !== null && itemForm.openingStockKg > 0) {
    return itemForm.openingStockTotalCostRp / itemForm.openingStockKg;
  }

  return itemForm.pricePerKgRp;
});
const purchaseUnitCost = computed(() =>
  purchaseForm.quantityKg > 0 ? purchaseForm.totalCostRp / purchaseForm.quantityKg : null,
);
const stockStatusLabel = computed(() => {
  switch (summary.value.stockStatus) {
    case "kritis":
      return "Kritis";
    case "warning":
      return "Warning";
    default:
      return "Aman";
  }
});
const stockStatusClass = computed(() => {
  switch (summary.value.stockStatus) {
    case "kritis":
      return "bg-rose-100 text-rose-700";
    case "warning":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-emerald-100 text-emerald-700";
  }
});

async function loadPage() {
  loading.value = true;
  error.value = "";

  try {
    farms.value = await listAccessibleFarms();

    const routeFarmId = String(route.query.farmId ?? "");
    if (routeFarmId && farms.value.some((farm) => farm.id === routeFarmId)) {
      selectedFarmId.value = routeFarmId;
    } else if (!selectedFarmId.value && farms.value[0]) {
      selectedFarmId.value = farms.value[0].id;
    }

    if (!selectedFarmId.value) {
      items.value = [];
      suppliers.value = [];
      purchases.value = [];
      transactions.value = [];
      summary.value = {
        totalStockKg: 0,
        grossStockKg: 0,
        lowStockCount: 0,
        totalItems: 0,
        averageFeedPricePerKgRp: 0,
        totalUsedTodayKg: 0,
        averageDailyUsageKg: 0,
        averageFeedPerBirdKg: null,
        estimatedStockDays: null,
        stockStatus: "aman",
      };
      usageHistory.value = [];
      return;
    }

    const [feedItems, feedSuppliers, feedPurchases, feedTransactions, feedSummary, feedUsageHistory] = await Promise.all([
      listFeedItemsByFarm(selectedFarmId.value),
      listFeedSuppliersByFarm(selectedFarmId.value),
      listFeedPurchasesByFarm(selectedFarmId.value),
      listFeedTransactionsByFarm(selectedFarmId.value),
      getFeedSummaryByFarm(selectedFarmId.value),
      listFeedUsageHistoryByFarm(selectedFarmId.value),
    ]);

    items.value = feedItems;
    suppliers.value = feedSuppliers;
    purchases.value = feedPurchases;
    transactions.value = feedTransactions;
    summary.value = feedSummary;
    usageHistory.value = feedUsageHistory;

    if (!transactionForm.feedItemId && feedItems[0]) {
      transactionForm.feedItemId = feedItems[0].id;
    }
    if (!purchaseForm.feedItemId && feedItems[0]) {
      purchaseForm.feedItemId = feedItems[0].id;
    }
    if (!purchaseForm.supplierId && feedSuppliers[0]) {
      purchaseForm.supplierId = feedSuppliers[0].id;
    }

  } catch (nextError) {
    console.error(nextError);
    error.value =
      nextError instanceof Error
        ? nextError.message
        : "Gagal memuat management pakan";
  } finally {
    loading.value = false;
  }
}

async function submitItem() {
  if (!selectedFarmId.value || !itemForm.name.trim()) {
    return;
  }

  try {
    error.value = "";
    await createFeedItem({
      farmId: selectedFarmId.value,
      name: itemForm.name,
      brand: itemForm.brand,
      unit: itemForm.unit,
      pricePerKgRp: effectiveOpeningPricePerKg.value,
      openingStockKg: itemForm.openingStockKg,
      reorderLevelKg: itemForm.reorderLevelKg,
      notes: itemForm.notes,
    });

    itemForm.name = "";
    itemForm.brand = "";
    itemForm.pricePerKgRp = 7500;
    itemForm.openingStockKg = 0;
    itemForm.openingStockTotalCostRp = null;
    itemForm.reorderLevelKg = 250;
    itemForm.notes = "";
    await loadPage();
  } catch (nextError) {
    console.error(nextError);
    error.value =
      nextError instanceof Error
        ? nextError.message
        : "Gagal menambahkan item pakan";
  }
}

async function submitTransaction() {
  if (
    !selectedFarmId.value ||
    !transactionForm.feedItemId ||
    transactionForm.quantityKg <= 0
  ) {
    return;
  }

  try {
    error.value = "";
    await createFeedTransaction({
      farmId: selectedFarmId.value,
      feedItemId: transactionForm.feedItemId,
      transactionType: transactionForm.transactionType,
      quantityKg: transactionForm.quantityKg,
      unitCost: effectiveUnitCost.value,
      transactionDate: transactionForm.transactionDate,
      notes: transactionForm.notes,
    });

    transactionForm.quantityKg = 0;
    transactionForm.totalCostRp = null;
    transactionForm.notes = "";
    await loadPage();
  } catch (nextError) {
    console.error(nextError);
    error.value =
      nextError instanceof Error
        ? nextError.message
        : "Gagal menyimpan transaksi pakan";
  }
}

async function submitSupplier() {
  if (!selectedFarmId.value || !supplierForm.name.trim()) {
    error.value = "Isi nama supplier terlebih dahulu";
    return;
  }

  try {
    error.value = "";
    await createFeedSupplier({
      farmId: selectedFarmId.value,
      name: supplierForm.name,
      contactName: supplierForm.contactName,
      phone: supplierForm.phone,
      paymentTermDays: supplierForm.paymentTermDays,
      notes: supplierForm.notes,
    });

    supplierForm.name = "";
    supplierForm.contactName = "";
    supplierForm.phone = "";
    supplierForm.paymentTermDays = 14;
    supplierForm.notes = "";
    await loadPage();
  } catch (nextError) {
    console.error(nextError);
    error.value =
      nextError instanceof Error ? nextError.message : "Gagal menambahkan supplier pakan";
  }
}

async function submitPurchase() {
  if (
    !selectedFarmId.value ||
    !purchaseForm.supplierId ||
    !purchaseForm.feedItemId ||
    purchaseForm.quantityKg <= 0 ||
    purchaseForm.totalCostRp <= 0
  ) {
    error.value = "Lengkapi supplier, item pakan, qty, dan total pembelian";
    return;
  }

  try {
    error.value = "";
    await createFeedPurchase({
      farmId: selectedFarmId.value,
      supplierId: purchaseForm.supplierId,
      feedItemId: purchaseForm.feedItemId,
      invoiceNumber: purchaseForm.invoiceNumber,
      purchaseDate: purchaseForm.purchaseDate,
      quantityKg: purchaseForm.quantityKg,
      totalCostRp: purchaseForm.totalCostRp,
      paymentDueDate: purchaseForm.paymentDueDate,
      notes: purchaseForm.notes,
    });

    purchaseForm.invoiceNumber = "";
    purchaseForm.quantityKg = 0;
    purchaseForm.totalCostRp = 0;
    purchaseForm.paymentDueDate = "";
    purchaseForm.notes = "";
    await loadPage();
  } catch (nextError) {
    console.error(nextError);
    error.value =
      nextError instanceof Error ? nextError.message : "Gagal menyimpan pembelian pakan";
  }
}

function exportPurchases() {
  downloadCsv(
    "pembelian-pakan.csv",
    ["Tanggal", "Supplier", "Item", "Invoice", "Qty kg", "Total", "Harga per kg", "Jatuh tempo", "Catatan"],
    purchases.value.map((purchase) => [
      purchase.purchase_date,
      purchase.supplier?.name ?? "-",
      purchase.feed_item?.name ?? "-",
      purchase.invoice_number ?? "",
      purchase.quantity_kg,
      purchase.total_cost_rp,
      purchase.price_per_kg_rp,
      purchase.payment_due_date ?? "",
      purchase.notes ?? "",
    ]),
  );
}

onMounted(() => {
  void loadPage();
});

watch([selectedFarmId, dataVersion], () => {
  void loadPage();
});

watch(
  () => transactionForm.feedItemId,
  () => {
    if (transactionForm.totalCostRp !== null && transactionForm.quantityKg <= 0) {
      transactionForm.totalCostRp = null;
    }
  },
);
</script>

<template>
  <AppLayout
    title="Pakan"
    subtitle="Kelola stok pakan, harga per kg, dan transaksi gudang per peternakan."
  >
    <section class="surface-card">
      <div class="grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <label class="app-label">Peternakan</label>
          <select v-model="selectedFarmId" class="app-input">
            <option v-for="farm in farms" :key="farm.id" :value="farm.id">
              {{ farm.name }}
            </option>
          </select>
        </div>
        <div class="flex items-end">
          <button class="btn-secondary" type="button" @click="exportPurchases">Export pembelian</button>
        </div>
      </div>
    </section>

    <p
      v-if="error"
      class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
    >
      {{ error }}
    </p>

    <section v-if="loading" class="surface-card text-sm text-slate-500">
      Memuat data pakan...
    </section>

    <template v-else>
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Stok tersedia"
          :value="`${formatDecimal(summary.totalStockKg)} kg`"
          helper="Stok aktif setelah baseline stok terakhir dan log pakan sesudahnya"
        />
        <MetricCard
          label="Pakan hari ini"
          :value="`${formatDecimal(summary.totalUsedTodayKg)} kg`"
          helper="Akumulasi pakan dipakai dari log harian hari ini"
        />
        <MetricCard
          label="Rata-rata harian"
          :value="`${formatDecimal(summary.averageDailyUsageKg)} kg`"
          helper="Rata-rata dari hari yang ada pencatatan pakan"
        />
        <MetricCard
          label="Konsumsi per ekor"
          :value="summary.averageFeedPerBirdKg !== null ? `${formatDecimal(summary.averageFeedPerBirdKg * 1000, { maximumFractionDigits: 1 })} g` : '-'"
          helper="Rata-rata konsumsi per ekor dari input hari ini"
        />
        <MetricCard
          label="Estimasi stok habis"
          :value="summary.estimatedStockDays !== null ? `${formatDecimal(summary.estimatedStockDays, { maximumFractionDigits: 1 })} hari` : '-'"
          helper="Berdasarkan stok tersedia dan rata-rata pemakaian harian"
        />
        <MetricCard
          label="Status stok"
          :value="stockStatusLabel"
          :helper="`${formatNumber(summary.lowStockCount)} item di bawah reorder level`"
        />
        <MetricCard
          label="Stok transaksi"
          :value="`${formatDecimal(summary.grossStockKg)} kg`"
          helper="Stok hasil transaksi gudang sebelum dikurangi pemakaian harian"
        />
        <MetricCard
          label="Rata-rata harga pakan"
          :value="formatCurrency(summary.averageFeedPricePerKgRp)"
          :helper="`${formatNumber(summary.totalItems)} item pakan aktif`"
        />
      </section>

      <section class="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <article class="surface-card">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-lg font-semibold text-ink">Kontrol pakan harian</p>
              <p class="text-sm text-slate-500">
                Catat stok di gudang dari menu ini, lalu input pakan dipakai lewat Input Harian per kandang.
              </p>
            </div>
            <span class="status-pill" :class="stockStatusClass">
              {{ stockStatusLabel }}
            </span>
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="text-xs text-slate-500">Stok tersedia</p>
              <p class="mt-1 text-lg font-semibold text-ink">
                {{ formatDecimal(summary.totalStockKg) }} kg
              </p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="text-xs text-slate-500">Safety check</p>
              <p class="mt-1 text-lg font-semibold text-ink">
                {{ summary.estimatedStockDays !== null ? `${formatDecimal(summary.estimatedStockDays, { maximumFractionDigits: 1 })} hari` : 'Belum cukup data' }}
              </p>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap gap-3">
            <RouterLink class="btn-primary" :to="selectedFarmId ? `/input?farmId=${selectedFarmId}` : '/input'">
              Input pakan harian
            </RouterLink>
            <RouterLink class="btn-secondary" :to="selectedFarmId ? `/history` : '/history'">
              Lihat riwayat log
            </RouterLink>
          </div>
        </article>

        <article class="surface-card">
          <p class="text-lg font-semibold text-ink">Peringatan pakan</p>
          <div class="mt-5 space-y-3 text-sm text-slate-700">
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="font-semibold text-ink">Status stok</p>
              <p class="mt-1">
                {{
                  summary.stockStatus === "kritis"
                    ? "Stok perlu segera ditambah agar operasional tidak terganggu."
                    : summary.stockStatus === "warning"
                      ? "Stok mulai menipis, siapkan pembelian berikutnya."
                      : "Stok pakan masih aman untuk operasional saat ini."
                }}
              </p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="font-semibold text-ink">Pemakaian harian</p>
              <p class="mt-1">
                Hari ini terpakai {{ formatDecimal(summary.totalUsedTodayKg) }} kg, rata-rata
                {{ formatDecimal(summary.averageDailyUsageKg) }} kg per hari.
              </p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="font-semibold text-ink">Reorder</p>
              <p class="mt-1">
                Ada {{ formatNumber(summary.lowStockCount) }} item yang sudah di bawah batas minimum.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section class="grid gap-5 lg:grid-cols-2">
        <article v-if="canManage" class="surface-card">
          <p class="text-lg font-semibold text-ink">Supplier pakan</p>
          <p class="text-sm text-slate-500">Catat supplier utama, kontak PIC, dan termin pembayaran.</p>

          <form class="mt-5 grid gap-4" @submit.prevent="submitSupplier">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Nama supplier</label>
                <input v-model="supplierForm.name" class="app-input" placeholder="CV Sumber Pakan" />
              </div>
              <div>
                <label class="app-label">PIC</label>
                <input v-model="supplierForm.contactName" class="app-input" placeholder="Nama sales / admin" />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">No. telepon</label>
                <input v-model="supplierForm.phone" class="app-input" placeholder="08xxxxxxxxxx" />
              </div>
              <div>
                <label class="app-label">Termin pembayaran (hari)</label>
                <input v-model.number="supplierForm.paymentTermDays" class="app-input" min="0" step="1" type="number" />
              </div>
            </div>

            <div>
              <label class="app-label">Catatan</label>
              <textarea v-model="supplierForm.notes" class="app-textarea" rows="3" placeholder="Alamat gudang, kebiasaan kirim, dll." />
            </div>

            <button class="btn-primary" type="submit">Tambah supplier</button>
          </form>

          <div class="mt-5 space-y-3">
            <div v-for="supplier in suppliers" :key="supplier.id" class="rounded-3xl bg-slate-50 p-4">
              <p class="font-semibold text-ink">{{ supplier.name }}</p>
              <p class="text-sm text-slate-500">
                {{ supplier.contact_name || "Tanpa PIC" }} • {{ supplier.phone || "Tanpa telepon" }}
              </p>
              <p class="mt-1 text-sm text-slate-600">
                Termin {{ formatNumber(supplier.payment_term_days) }} hari
                <span v-if="supplier.notes">• {{ supplier.notes }}</span>
              </p>
            </div>
          </div>
        </article>

        <article class="surface-card">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-lg font-semibold text-ink">Pembelian pakan</p>
              <p class="text-sm text-slate-500">Pembelian baru otomatis menambah stok gudang dan memperbarui harga per kg.</p>
            </div>
            <span class="status-pill bg-sky-100 text-sky-700">purchasing</span>
          </div>

          <form v-if="canManage" class="mt-5 grid gap-4" @submit.prevent="submitPurchase">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Supplier</label>
                <select v-model="purchaseForm.supplierId" class="app-input">
                  <option value="" disabled>Pilih supplier</option>
                  <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
                    {{ supplier.name }}
                  </option>
                </select>
              </div>
              <div>
                <label class="app-label">Item pakan</label>
                <select v-model="purchaseForm.feedItemId" class="app-input">
                  <option value="" disabled>Pilih item pakan</option>
                  <option v-for="item in items" :key="item.id" :value="item.id">
                    {{ item.name }}{{ item.brand ? ` • ${item.brand}` : "" }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Tanggal pembelian</label>
                <input v-model="purchaseForm.purchaseDate" class="app-input" type="date" />
              </div>
              <div>
                <label class="app-label">No. invoice</label>
                <input v-model="purchaseForm.invoiceNumber" class="app-input" placeholder="INV-2024-001" />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <div>
                <label class="app-label">Qty (kg)</label>
                <input v-model.number="purchaseForm.quantityKg" class="app-input" min="0.1" step="0.1" type="number" />
              </div>
              <div>
                <label class="app-label">Total pembelian (Rp)</label>
                <input v-model.number="purchaseForm.totalCostRp" class="app-input" min="0" step="1" type="number" />
              </div>
              <div>
                <label class="app-label">Jatuh tempo</label>
                <input v-model="purchaseForm.paymentDueDate" class="app-input" type="date" />
              </div>
            </div>

            <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Harga beli / kg:
              <span class="font-semibold text-ink">
                {{ purchaseUnitCost !== null ? formatCurrency(purchaseUnitCost) : "-" }}
              </span>
            </div>

            <div>
              <label class="app-label">Catatan</label>
              <textarea v-model="purchaseForm.notes" class="app-textarea" rows="3" placeholder="Keterangan kirim, DP, atau jadwal bayar" />
            </div>

            <button class="btn-primary" type="submit" :disabled="!suppliers.length || !items.length">
              Simpan pembelian
            </button>
          </form>

          <div class="mt-5 space-y-3">
            <div v-for="purchase in purchases" :key="purchase.id" class="rounded-3xl bg-slate-50 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-semibold text-ink">
                    {{ purchase.feed_item?.name || "-" }} • {{ purchase.supplier?.name || "-" }}
                  </p>
                  <p class="text-sm text-slate-500">
                    {{ purchase.purchase_date }} • {{ formatDecimal(purchase.quantity_kg) }} kg •
                    {{ formatCurrency(purchase.total_cost_rp) }}
                  </p>
                </div>
                <span class="status-pill bg-emerald-100 text-emerald-700">
                  {{ formatCurrency(purchase.price_per_kg_rp) }}/kg
                </span>
              </div>
              <p class="mt-2 text-sm text-slate-600">
                {{ purchase.invoice_number || "Tanpa invoice" }}
                <span v-if="purchase.payment_due_date">• jatuh tempo {{ purchase.payment_due_date }}</span>
                <span v-if="purchase.notes">• {{ purchase.notes }}</span>
              </p>
            </div>
          </div>
        </article>
      </section>

      <section class="grid gap-5 lg:grid-cols-2">
        <article v-if="canManage" ref="itemFormSection" class="surface-card">
          <p class="text-lg font-semibold text-ink">Tambah item pakan</p>
          <p class="text-sm text-slate-500">
            Buat daftar pakan, stok awal, dan harga dasar per peternakan.
          </p>

          <form class="mt-5 grid gap-4" @submit.prevent="submitItem">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Nama pakan</label>
                <input
                  v-model="itemForm.name"
                  class="app-input"
                  placeholder="Pakan Layer 324"
                />
              </div>
              <div>
                <label class="app-label">Brand</label>
                <input
                  v-model="itemForm.brand"
                  class="app-input"
                  placeholder="Japfa / custom"
                />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Unit</label>
                <input v-model="itemForm.unit" class="app-input" />
              </div>
              <div>
                <label class="app-label">Harga pakan / kg (Rp)</label>
                <input
                  v-model.number="itemForm.pricePerKgRp"
                  class="app-input"
                  min="0"
                  step="1"
                  type="number"
                />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Stok pakan awal (kg)</label>
                <input
                  v-model.number="itemForm.openingStockKg"
                  class="app-input"
                  min="0"
                  step="0.1"
                  type="number"
                />
              </div>
              <div>
                <label class="app-label">Total nilai stok awal (Rp)</label>
                <input
                  v-model.number="itemForm.openingStockTotalCostRp"
                  class="app-input"
                  min="0"
                  step="1"
                  type="number"
                  placeholder="Opsional, mis. 350000"
                />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Reorder level (kg)</label>
                <input
                  v-model.number="itemForm.reorderLevelKg"
                  class="app-input"
                  min="0"
                  step="0.1"
                  type="number"
                />
              </div>
              <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p>
                  Harga efektif stok awal / kg:
                  <span class="font-semibold text-ink">
                    {{ formatCurrency(effectiveOpeningPricePerKg) }}
                  </span>
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  Jika isi total nilai stok awal, sistem akan otomatis hitung harga/kg.
                </p>
              </div>
            </div>

            <div>
              <label class="app-label">Catatan</label>
              <textarea
                v-model="itemForm.notes"
                class="app-textarea"
                rows="3"
                placeholder="Supplier, formula, atau catatan gudang"
              />
            </div>

            <button class="btn-primary" type="submit">Tambah item</button>
          </form>
        </article>

        <article ref="transactionFormSection" class="surface-card">
          <p class="text-lg font-semibold text-ink">Transaksi pakan</p>
          <p class="text-sm text-slate-500">
            Catat stok masuk, keluar, atau penyesuaian stok.
          </p>

          <form
            v-if="canManage"
            class="mt-5 grid gap-4"
            @submit.prevent="submitTransaction"
          >
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Item pakan</label>
                <select v-model="transactionForm.feedItemId" class="app-input">
                  <option value="" disabled>Pilih item</option>
                  <option v-for="item in items" :key="item.id" :value="item.id">
                    {{ item.name }}{{ item.brand ? ` • ${item.brand}` : "" }}
                  </option>
                </select>
              </div>
              <div>
                <label class="app-label">Tipe transaksi</label>
                <select
                  v-model="transactionForm.transactionType"
                  class="app-input"
                >
                  <option value="in">Masuk</option>
                  <option value="out">Keluar</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <div>
                <label class="app-label">Qty (kg)</label>
                <input
                  v-model.number="transactionForm.quantityKg"
                  class="app-input"
                  min="0.1"
                  step="0.1"
                  type="number"
                />
              </div>
              <div>
                <label class="app-label">Total harga (Rp)</label>
                <input
                  v-model.number="transactionForm.totalCostRp"
                  class="app-input"
                  min="0"
                  step="1"
                  type="number"
                />
              </div>
              <div>
                <label class="app-label">Tanggal</label>
                <input
                  v-model="transactionForm.transactionDate"
                  class="app-input"
                  type="date"
                />
              </div>
             </div>

            <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p>
                Harga efektif / kg:
                <span class="font-semibold text-ink">
                  {{ effectiveUnitCost !== null ? formatCurrency(effectiveUnitCost) : '-' }}
                </span>
              </p>
              <p class="mt-1">
                Total transaksi:
                <span class="font-semibold text-ink">
                  {{ estimatedTotalCost !== null ? formatCurrency(estimatedTotalCost) : '-' }}
                </span>
              </p>
              <p class="mt-1 text-xs text-slate-500">
                Isi total harga pembelian. Contoh 50 kg dan total Rp350.000 akan dibaca sebagai Rp7.000/kg.
              </p>
            </div>

            <div>
              <label class="app-label">Catatan</label>
              <textarea
                v-model="transactionForm.notes"
                class="app-textarea"
                rows="3"
                placeholder="Pembelian, distribusi, koreksi stok, dll."
              />
            </div>

            <button class="btn-primary" type="submit">Simpan transaksi</button>
          </form>

          <div class="mt-5 space-y-3">
            <div
              v-for="transaction in transactions"
              :key="transaction.id"
              class="rounded-3xl bg-slate-50 p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-semibold text-ink">
                    {{ transaction.feed_item?.name || "-" }}
                  </p>
                  <p class="text-sm text-slate-500">
                    {{ transaction.transaction_type }} •
                    {{ formatDecimal(transaction.quantity_kg) }} kg •
                    {{ transaction.transaction_date }}
                  </p>
                  <p class="mt-1 text-sm text-slate-500">
                    Harga/kg
                    <span>
                      {{
                        formatCurrency(
                          normalizeFeedUnitCost(transaction.unit_cost, transaction.quantity_kg) ?? 0,
                        )
                      }}
                    </span>
                    <span v-if="normalizeFeedTotalCost(transaction.unit_cost, transaction.quantity_kg) !== null">
                      • total
                      {{
                        formatCurrency(
                          normalizeFeedTotalCost(transaction.unit_cost, transaction.quantity_kg) ?? 0,
                        )
                      }}
                    </span>
                  </p>
                </div>
                <span
                  class="status-pill"
                  :class="
                    transaction.transaction_type === 'in'
                      ? 'bg-emerald-100 text-emerald-700'
                      : transaction.transaction_type === 'out'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-slate-200 text-slate-700'
                  "
                >
                  {{ transaction.transaction_type }}
                </span>
              </div>
              <p class="mt-2 text-sm text-slate-600">
                {{ transaction.notes || "Tanpa catatan" }}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-lg font-semibold text-ink">Riwayat pemakaian pakan</p>
            <p class="text-sm text-slate-500">
               Pantau pemakaian harian per kandang agar konsumsi tidak boros dan mudah dicek ulang.
            </p>
          </div>
          <RouterLink class="btn-secondary !py-2.5" :to="selectedFarmId ? `/input?farmId=${selectedFarmId}` : '/input'">
            Input harian
          </RouterLink>
        </div>

        <div v-if="usageHistory.length" class="space-y-3">
          <article
            v-for="usage in usageHistory"
            :key="usage.id"
            class="surface-card"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-ink">{{ usage.flock_code }} • {{ usage.flock_name }}</p>
                <p class="text-sm text-slate-500">{{ usage.log_date }}</p>
              </div>
              <span
                class="status-pill"
                :class="usage.sync_status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'"
              >
                {{ usage.sync_status }}
              </span>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Pakan dipakai</p>
                <p class="font-semibold text-ink">{{ formatDecimal(usage.feed_used_kg) }} kg</p>
              </div>
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Populasi hidup</p>
                <p class="font-semibold text-ink">{{ formatNumber(usage.live_population) }} ekor</p>
              </div>
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Konsumsi / ekor</p>
                <p class="font-semibold text-ink">
                  {{
                    usage.feed_per_bird_kg !== null
                      ? `${formatDecimal(usage.feed_per_bird_kg * 1000, { maximumFractionDigits: 1 })} g`
                      : '-'
                  }}
                </p>
              </div>
            </div>
          </article>
        </div>
        <EmptyState
          v-else
          title="Belum ada pemakaian pakan"
          description="Masuk ke Input Harian untuk mencatat pakan dipakai per kandang."
        />
      </section>

      <section class="space-y-4">
        <div>
          <p class="text-lg font-semibold text-ink">Stok item pakan</p>
          <p class="text-sm text-slate-500">
            Pantau stok aktif, stok awal, dan item yang perlu reorder.
          </p>
        </div>

        <div v-if="items.length" class="grid gap-4 lg:grid-cols-2">
          <article v-for="item in items" :key="item.id" class="surface-card">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-ink">{{ item.name }}</h3>
                <p class="text-sm text-slate-500">
                  {{ item.brand || "Tanpa brand" }} • unit {{ item.unit }}
                </p>
              </div>
              <span
                class="status-pill"
                :class="
                  item.current_stock_kg <= item.reorder_level_kg
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-emerald-100 text-emerald-700'
                "
              >
                {{
                  item.current_stock_kg <= item.reorder_level_kg
                    ? "Perlu reorder"
                    : "Aman"
                }}
              </span>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Stok saat ini</p>
                <p class="font-semibold text-ink">
                  {{ formatDecimal(item.current_stock_kg) }} kg
                </p>
              </div>
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Stok awal</p>
                <p class="font-semibold text-ink">
                  {{ formatDecimal(item.opening_stock_kg) }} kg
                </p>
              </div>
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Harga pakan / kg</p>
                <p class="font-semibold text-ink">
                  {{ formatCurrency(normalizeFeedItemPrice(item.price_per_kg_rp, item.opening_stock_kg)) }}
                </p>
              </div>
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Reorder level</p>
                <p class="font-semibold text-ink">
                  {{ formatDecimal(item.reorder_level_kg) }} kg
                </p>
              </div>
            </div>

            <p class="mt-3 text-sm text-slate-600">
              {{ item.notes || "Tidak ada catatan item." }}
            </p>
          </article>
        </div>
        <EmptyState
          v-else
          title="Belum ada item pakan"
          description="Tambahkan item pakan pertama untuk mulai mencatat stok dan transaksi."
        />
      </section>
    </template>
  </AppLayout>
</template>
