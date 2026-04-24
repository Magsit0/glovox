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
