/**
 * Artifact detection and extraction from AI responses.
 * Identifies code blocks, tables, documents, and other structured content.
 */

import type { Artifact, ArtifactType } from "@/components/artifacts/ArtifactPanel";

let artifactCounter = 0;

function generateId(): string {
  return `artifact-${Date.now()}-${++artifactCounter}`;
}

/**
 * Detect and extract artifacts from a markdown response.
 * Returns artifacts found in the content.
 */
export function extractArtifacts(content: string): Artifact[] {
  const artifacts: Artifact[] = [];

  // Extract code blocks (>= 5 lines)
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1] || "text";
    const code = match[2].trim();
    const lines = code.split("\n").length;

    if (lines >= 5) {
      artifacts.push({
        id: generateId(),
        type: "code",
        title: `${language} code (${lines} lines)`,
        content: code,
        language,
        createdAt: Date.now(),
      });
    }
  }

  // Extract markdown tables (>= 3 rows)
  const tableRegex = /(\|.+\|[\r\n]+\|[-: |]+\|[\r\n]+((\|.+\|[\r\n]*)+))/g;
  while ((match = tableRegex.exec(content)) !== null) {
    const table = match[1].trim();
    const rows = table.split("\n").filter((l) => l.trim().startsWith("|")).length;
    if (rows >= 3) {
      artifacts.push({
        id: generateId(),
        type: "table",
        title: `Table (${rows} rows)`,
        content: table,
        createdAt: Date.now(),
      });
    }
  }

  // Extract HTML blocks
  const htmlRegex = /```html\n([\s\S]*?)```/g;
  while ((match = htmlRegex.exec(content)) !== null) {
    const html = match[1].trim();
    if (html.includes("<") && html.length > 100) {
      artifacts.push({
        id: generateId(),
        type: "html",
        title: "HTML Preview",
        content: html,
        createdAt: Date.now(),
      });
    }
  }

  return artifacts;
}

/**
 * Check if a response has any content worth showing in the artifact panel.
 */
export function hasArtifacts(content: string): boolean {
  return extractArtifacts(content).length > 0;
}
