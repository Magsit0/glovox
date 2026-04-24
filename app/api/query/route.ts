import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/bigquery";

/**
 * Named queries — only these are exposed to the client.
 * Add new queries here as the dashboard grows.
 * Params are validated per-query before being passed to BigQuery.
 */
const QUERIES: Record<
  string,
  (params: Record<string, string>) => { sql: string; params?: Record<string, unknown> }
> = {
  // Example: replace with your actual dataset/table
  sample: () => ({
    sql: `SELECT * FROM \`${process.env.BIGQUERY_PROJECT_ID}.sample_dataset.sample_table\` LIMIT 100`,
  }),
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const name = searchParams.get("q");

  if (!name || !(name in QUERIES)) {
    return NextResponse.json({ error: "Unknown query" }, { status: 400 });
  }

  const clientParams = Object.fromEntries(searchParams.entries());
  const { sql, params } = QUERIES[name](clientParams);

  try {
    const rows = await query(sql, params);
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[BigQuery]", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
