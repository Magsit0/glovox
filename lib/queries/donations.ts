import { fetchAllByRef, type MpPayment } from "@/lib/mercadopago";

// TODO: replace with live MP query once we have a dedicated yoga endpoint/source.
// MP's /payments/search caps offset at 1000, so we can't page through all
// approved payments to filter yoga in-memory. Hardcoded for now.
const YOGA_HARDCODED_AMOUNT = 900000;

export type DonationBucket = { amount: number; count: number };

export type DonationTotals = {
  cortesias: DonationBucket;
  yoga: DonationBucket;
  total: DonationBucket;
};

const emptyBucket = (): DonationBucket => ({ amount: 0, count: 0 });

function addTo(bucket: DonationBucket, p: MpPayment) {
  bucket.amount += p.transaction_amount;
  bucket.count += 1;
}

export const MP_COMMISSION_RATE = 0.0319;

export type DonationPaymentRow = {
  id: number;
  date: string;
  gross: number;
  fee: number;
  net: number;
  runningNet: number;
  allocated: boolean;
};

export type DonationProject = {
  name: string;
  targetNet: number;
  grossNeeded: number;
  payments: DonationPaymentRow[];
  allocatedCount: number;
  allocatedGross: number;
  allocatedNet: number;
};

export async function getJardinBoskoProject(): Promise<DonationProject> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set");

  const TARGET_NET = 3_598_186;
  const grossNeeded = TARGET_NET / (1 - MP_COMMISSION_RATE);

  const raw = await fetchAllByRef("DONATION", token);
  const sorted = [...raw]
    .filter((p) => p.transaction_amount >= 2000)
    .sort((a, b) =>
      (a.date_approved ?? a.date_created).localeCompare(b.date_approved ?? b.date_created)
    );

  let runningNet = 0;
  let runningGross = 0;
  const payments: DonationPaymentRow[] = [];
  for (const p of sorted) {
    if (runningGross >= grossNeeded) break;
    const fee = p.transaction_amount * MP_COMMISSION_RATE;
    const net = p.transaction_amount - fee;
    runningNet += net;
    runningGross += p.transaction_amount;
    payments.push({
      id: p.id,
      date: p.date_approved ?? p.date_created,
      gross: p.transaction_amount,
      fee: Math.round(fee),
      net: Math.round(net),
      runningNet: Math.round(runningNet),
      allocated: true,
    });
  }

  const allocated = payments;
  return {
    name: "Jardín Bosko",
    targetNet: TARGET_NET,
    grossNeeded: Math.round(grossNeeded),
    payments,
    allocatedCount: allocated.length,
    allocatedGross: Math.round(allocated.reduce((s, p) => s + p.gross, 0)),
    allocatedNet: Math.round(allocated.reduce((s, p) => s + p.net, 0)),
  };
}

export async function getDonationTotals(): Promise<DonationTotals> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set");

  const cortesiaPayments = await fetchAllByRef("DONATION", token);

  const cortesias = emptyBucket();
  for (const p of cortesiaPayments) addTo(cortesias, p);

  const yoga: DonationBucket = { amount: YOGA_HARDCODED_AMOUNT, count: 0 };

  const total: DonationBucket = {
    amount: cortesias.amount + yoga.amount,
    count: cortesias.count + yoga.count,
  };

  return { cortesias, yoga, total };
}
