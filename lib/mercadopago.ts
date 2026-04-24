const BASE = "https://api.mercadopago.com/v1/payments/search";

export type MpMonthlyRow = {
  month: string;
  amount: number;
  count: number;
};

export type MpPayment = {
  date_approved: string | null;
  date_created: string;
  transaction_amount: number;
  status: string;
  external_reference?: string | null;
  description?: string | null;
  currency_id?: string | null;
};

type MpSearchResponse = {
  paging: { total: number; limit: number; offset: number };
  results: MpPayment[];
};

export async function fetchAllByRef(
  ref: string,
  token: string,
): Promise<MpPayment[]> {
  const all: MpPayment[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      sort: "date_created",
      criteria: "desc",
      range: "date_created",
      begin_date: "2025-01-01T00:00:00.000-00:00",
      end_date: "NOW",
      status: "approved",
      external_reference: ref,
      limit: String(limit),
      offset: String(offset),
    });

    const res = await fetch(`${BASE}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MercadoPago API error ${res.status} for ref=${ref}: ${body}`);
    }

    const data: MpSearchResponse = await res.json();
    all.push(...data.results);

    if (offset + limit >= data.paging.total) break;
    offset += limit;
  }

  return all;
}

export async function getMpMonthlyEarnings(): Promise<MpMonthlyRow[]> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set");

  const [prime, primeYearly] = await Promise.all([
    fetchAllByRef("PRIME", token),
    fetchAllByRef("PRIME_YEARLY", token),
  ]);

  const map = new Map<string, { amount: number; count: number }>();

  for (const p of [...prime, ...primeYearly]) {
    const dateStr = p.date_approved ?? p.date_created;
    const month = dateStr.slice(0, 7); // "2025-01"
    const entry = map.get(month) ?? { amount: 0, count: 0 };
    entry.amount += p.transaction_amount;
    entry.count += 1;
    map.set(month, entry);
  }

  return Array.from(map.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
