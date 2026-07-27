// Simple LCS-based line diff. O(n*m) — fine for typical text/code files;
// callers should cap input size for very large files rather than diffing
// megabyte-scale text in the browser.

export function diffLines(oldText, newText) {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const n = a.length;
  const m = b.length;

  // Build LCS length table
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ type: 'same', line: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'remove', line: a[i] });
      i++;
    } else {
      result.push({ type: 'add', line: b[j] });
      j++;
    }
  }
  while (i < n) { result.push({ type: 'remove', line: a[i] }); i++; }
  while (j < m) { result.push({ type: 'add', line: b[j] }); j++; }

  return result;
}

export function diffStats(diffResult) {
  let added = 0, removed = 0;
  diffResult.forEach((r) => { if (r.type === 'add') added++; if (r.type === 'remove') removed++; });
  return { added, removed };
}

// Safety cap — LCS table is O(n*m) memory/time, so guard against pathological inputs.
export const MAX_DIFF_LINES = 4000;
