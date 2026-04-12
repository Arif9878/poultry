<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import EmptyState from "../components/EmptyState.vue";
import MetricCard from "../components/MetricCard.vue";
import { useAuth } from "../composables/useAuth";
import { dataVersion } from "../lib/appState";
import {
  createFeedItem,
  createFeedTransaction,
  getFeedSummaryByFarm,
  listFeedItemsByFarm,
  listFeedTransactionsByFarm,
} from "../services/feed.service";
import { listAccessibleFarms } from "../services/farms.service";
import type {
  Farm,
  FeedItem,
  FeedSummary,
  FeedTransaction,
} from "../types/models";
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
const transactions = ref<FeedTransaction[]>([]);
const summary = ref<FeedSummary>({
  totalStockKg: 0,
  lowStockCount: 0,
  totalItems: 0,
  averageFeedPricePerKgRp: 0,
});
const loading = ref(false);
const error = ref("");
const showFabMenu = ref(false);
const itemFormSection = ref<HTMLElement | null>(null);
const transactionFormSection = ref<HTMLElement | null>(null);

const itemForm = reactive({
  name: "",
  brand: "",
  unit: "kg",
  pricePerKgRp: 7500,
  openingStockKg: 0,
  reorderLevelKg: 250,
  notes: "",
});

const transactionForm = reactive({
  feedItemId: "",
  transactionType: "in" as const,
  quantityKg: 0,
  unitCost: null as number | null,
  transactionDate: getTodayDate(),
  notes: "",
});

const canManage = computed(() => profile.value?.role !== "operator");
const selectedFeedItem = computed(
  () =>
    items.value.find((item) => item.id === transactionForm.feedItemId) ?? null,
);

async function jumpToSection(section: "item" | "transaction") {
  showFabMenu.value = false;
  await nextTick();
  const target =
    section === "item" ? itemFormSection.value : transactionFormSection.value;
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

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
      transactions.value = [];
      summary.value = {
        totalStockKg: 0,
        lowStockCount: 0,
        totalItems: 0,
        averageFeedPricePerKgRp: 0,
      };
      return;
    }

    const [feedItems, feedTransactions, feedSummary] = await Promise.all([
      listFeedItemsByFarm(selectedFarmId.value),
      listFeedTransactionsByFarm(selectedFarmId.value),
      getFeedSummaryByFarm(selectedFarmId.value),
    ]);

    items.value = feedItems;
    transactions.value = feedTransactions;
    summary.value = feedSummary;

    if (!transactionForm.feedItemId && feedItems[0]) {
      transactionForm.feedItemId = feedItems[0].id;
    }

    if (
      transactionForm.feedItemId &&
      selectedFeedItem.value &&
      transactionForm.unitCost === null
    ) {
      transactionForm.unitCost = selectedFeedItem.value.price_per_kg_rp || null;
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
      pricePerKgRp: itemForm.pricePerKgRp,
      openingStockKg: itemForm.openingStockKg,
      reorderLevelKg: itemForm.reorderLevelKg,
      notes: itemForm.notes,
    });

    itemForm.name = "";
    itemForm.brand = "";
    itemForm.pricePerKgRp = 7500;
    itemForm.openingStockKg = 0;
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
      unitCost: transactionForm.unitCost,
      transactionDate: transactionForm.transactionDate,
      notes: transactionForm.notes,
    });

    transactionForm.quantityKg = 0;
    transactionForm.unitCost = selectedFeedItem.value?.price_per_kg_rp ?? null;
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

onMounted(() => {
  void loadPage();
});

watch([selectedFarmId, dataVersion], () => {
  void loadPage();
});

watch(
  () => transactionForm.feedItemId,
  () => {
    if (selectedFeedItem.value) {
      transactionForm.unitCost = selectedFeedItem.value.price_per_kg_rp || null;
    }
  },
);
</script>

<template>
  <AppLayout
    title="Management Pakan"
    subtitle="Kelola stok pakan, harga pakan per kg, dan transaksi gudang per farm."
  >
    <section class="surface-card">
      <div class="grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <label class="app-label">Farm</label>
          <select v-model="selectedFarmId" class="app-input">
            <option v-for="farm in farms" :key="farm.id" :value="farm.id">
              {{ farm.name }}
            </option>
          </select>
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
          label="Stok total"
          :value="`${formatDecimal(summary.totalStockKg)} kg`"
          helper="Akumulasi semua item pakan"
        />
        <MetricCard
          label="Item pakan"
          :value="formatNumber(summary.totalItems)"
          helper="Jumlah SKU pakan per farm"
        />
        <MetricCard
          label="Low stock"
          :value="formatNumber(summary.lowStockCount)"
          helper="Item di bawah reorder level"
        />
        <MetricCard
          label="Rata-rata harga pakan"
          :value="formatCurrency(summary.averageFeedPricePerKgRp)"
          helper="Harga item pakan aktif per kg"
        />
      </section>

      <section class="grid gap-5 lg:grid-cols-2">
        <article v-if="canManage" ref="itemFormSection" class="surface-card">
          <p class="text-lg font-semibold text-ink">Tambah item pakan</p>
          <p class="text-sm text-slate-500">
            Buat daftar pakan, stok awal, dan harga dasar per farm.
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
                <label class="app-label">Reorder level (kg)</label>
                <input
                  v-model.number="itemForm.reorderLevelKg"
                  class="app-input"
                  min="0"
                  step="0.1"
                  type="number"
                />
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
                <label class="app-label">Harga/kg (Rp)</label>
                <input
                  v-model.number="transactionForm.unitCost"
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
                    Harga
                    {{
                      formatCurrency(
                        transaction.unit_cost ??
                          selectedFeedItem?.price_per_kg_rp ??
                          0,
                      )
                    }}
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
                  {{ formatCurrency(item.price_per_kg_rp) }}
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

      <!-- <div v-if="canManage" class="fab-menu">
        <template v-if="showFabMenu">
          <button class="fab-subaction" type="button" @click="jumpToSection('transaction')">
            <span class="text-base leading-none">+</span>
            <span>Transaksi pakan</span>
          </button>
          <button class="fab-subaction" type="button" @click="jumpToSection('item')">
            <span class="text-base leading-none">+</span>
            <span>Item pakan</span>
          </button>
        </template>

        <button class="fab-primary" type="button" @click="showFabMenu = !showFabMenu">
          <span class="text-lg leading-none">{{ showFabMenu ? 'x' : '+' }}</span>
          <span>{{ showFabMenu ? 'Tutup' : 'Tambah data' }}</span>
        </button>
      </div> -->
    </template>
  </AppLayout>
</template>
