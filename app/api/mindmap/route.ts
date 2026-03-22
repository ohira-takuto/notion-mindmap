import { Client } from "@notionhq/client";
import { NextRequest, NextResponse } from "next/server";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const MINDMAP_MARKER = "<!-- notion-mindmap-data -->";

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  try {
    const blocks = await notion.blocks.children.list({ block_id: pageId });

    for (const block of blocks.results as any[]) {
      if (block.type === "code" && block.code?.language === "json") {
        const text = block.code.rich_text?.[0]?.plain_text ?? "";
        if (text.startsWith(MINDMAP_MARKER)) {
          const json = text.replace(MINDMAP_MARKER, "").trim();
          return NextResponse.json({ data: JSON.parse(json), blockId: block.id });
        }
      }
    }

    // デフォルトデータを返す（初回）
    return NextResponse.json({ data: null, blockId: null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { pageId, data, blockId } = await req.json();
  if (!pageId || !data) return NextResponse.json({ error: "pageId and data required" }, { status: 400 });

  const content = `${MINDMAP_MARKER}\n${JSON.stringify(data, null, 2)}`;

  try {
    if (blockId) {
      // 既存ブロックを更新
      await (notion.blocks as any).update({
        block_id: blockId,
        code: {
          rich_text: [{ type: "text", text: { content } }],
          language: "json",
        },
      });
      return NextResponse.json({ success: true, blockId });
    } else {
      // 新規ブロックを追加
      const res = await notion.blocks.children.append({
        block_id: pageId,
        children: [{
          object: "block",
          type: "code",
          code: {
            rich_text: [{ type: "text", text: { content } }],
            language: "json",
          },
        } as any],
      });
      const newBlock = (res.results as any[])[0];
      return NextResponse.json({ success: true, blockId: newBlock.id });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
