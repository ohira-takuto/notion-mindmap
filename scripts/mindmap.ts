#!/usr/bin/env npx ts-node
/**
 * Notion MindMap CLI
 * Claude Codeから呼び出すヘルパースクリプト
 *
 * 使い方:
 *   npx ts-node scripts/mindmap.ts set <pageId> '<JSON>'
 *   npx ts-node scripts/mindmap.ts get <pageId>
 *   npx ts-node scripts/mindmap.ts embed <pageId> <appUrl>
 */

import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const MARKER = "<!-- notion-mindmap-data -->";

async function getMap(pageId: string) {
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  for (const block of blocks.results as any[]) {
    if (block.type === "code" && block.code?.language === "json") {
      const text = block.code.rich_text?.[0]?.plain_text ?? "";
      if (text.startsWith(MARKER)) {
        return { data: JSON.parse(text.replace(MARKER, "").trim()), blockId: block.id };
      }
    }
  }
  return { data: null, blockId: null };
}

async function setMap(pageId: string, data: object) {
  const content = `${MARKER}\n${JSON.stringify(data, null, 2)}`;
  const { blockId } = await getMap(pageId);

  if (blockId) {
    await (notion.blocks as any).update({
      block_id: blockId,
      code: { rich_text: [{ type: "text", text: { content } }], language: "json" },
    });
    console.log("✅ マインドマップを更新しました:", blockId);
  } else {
    const res = await notion.blocks.children.append({
      block_id: pageId,
      children: [{
        object: "block", type: "code",
        code: { rich_text: [{ type: "text", text: { content } }], language: "json" },
      } as any],
    });
    const newBlock = (res.results as any[])[0];
    console.log("✅ マインドマップを新規作成しました:", newBlock.id);
  }
}

async function embedMap(pageId: string, appUrl: string) {
  const embedUrl = `${appUrl}?pageId=${pageId}`;
  await notion.blocks.children.append({
    block_id: pageId,
    children: [{
      object: "block",
      type: "embed",
      embed: { url: embedUrl },
    } as any],
  });
  console.log("✅ 埋め込みブロックを追加しました:", embedUrl);
}

// CLIエントリーポイント
const [,, cmd, pageId, ...rest] = process.argv;

(async () => {
  if (!pageId) { console.error("pageIdが必要です"); process.exit(1); }

  if (cmd === "get") {
    const { data } = await getMap(pageId);
    console.log(JSON.stringify(data, null, 2));
  } else if (cmd === "set") {
    const data = JSON.parse(rest[0]);
    await setMap(pageId, data);
  } else if (cmd === "embed") {
    await embedMap(pageId, rest[0]);
  } else {
    console.error("コマンドは get / set / embed のいずれかです");
    process.exit(1);
  }
})();
