import type { DiffFile, DiffHunk, DiffLine } from './types.ts';

const path = (value: string) => value.replace(/^[ab]\//, '');

export function parseUnifiedDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | undefined;
  let hunk: DiffHunk | undefined;
  let oldNo = 0, newNo = 0;

  const ensureFile = (name = '') => file ??= { path: name, additions: 0, deletions: 0, hunks: [] };
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^diff --git a\/(.*) b\/(.*)$/);
    if (header) {
      file = { path: path(`b/${header[2]}`), additions: 0, deletions: 0, hunks: [] };
      if (header[1] !== header[2]) file.oldPath = path(`a/${header[1]}`);
      files.push(file); hunk = undefined; continue;
    }
    const renameFrom = line.match(/^rename from (.*)$/);
    if (renameFrom) { ensureFile().oldPath = renameFrom[1]!; continue; }
    const renameTo = line.match(/^rename to (.*)$/);
    if (renameTo) { ensureFile().path = renameTo[1]!; continue; }
    if (/^(?:new file mode|deleted file mode|old mode|new mode) /.test(line)) { ensureFile(); continue; }
    const binary = line.match(/^Binary files (.*) and (.*) differ$/);
    if (binary) { const current = ensureFile(path(binary[2]!)); current.binary = true; current.hunks = []; continue; }
    if (/^--- /.test(line) || /^\+\+\+ /.test(line)) continue;
    const range = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (range) {
      oldNo = Number(range[1]); newNo = Number(range[3]);
      hunk = { header: line, lines: [] }; ensureFile().hunks.push(hunk); continue;
    }
    if (!hunk) continue;
    let parsed: DiffLine | undefined;
    if (line.startsWith('+')) { parsed = { type: 'add', text: line.slice(1), newNo: newNo++ }; file!.additions++; }
    else if (line.startsWith('-')) { parsed = { type: 'del', text: line.slice(1), oldNo: oldNo++ }; file!.deletions++; }
    else if (line.startsWith(' ')) { parsed = { type: 'ctx', text: line.slice(1), oldNo: oldNo++, newNo: newNo++ }; }
    else if (line === '\\ No newline at end of file') parsed = { type: 'meta', text: line };
    if (parsed) hunk.lines.push(parsed);
  }
  return files;
}
