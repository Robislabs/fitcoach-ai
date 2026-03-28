import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL!;

export async function POST(req: NextRequest) {
  const body = await req.json();

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = { raw: await response.text() };
  }

  if (!response.ok) {
    return NextResponse.json({ error: "Workflow error", detail: data }, { status: 502 });
  }

  return NextResponse.json(data);
}
