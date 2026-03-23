#!/usr/bin/env node
// generate-cpid-static.js
// Transforms cpid-auto-merge.json into src/data/cpid-pending-merges.json
// Copies cpid-review-queue.json verbatim to src/data/cpid-review-queue.json

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const AUTO_MERGE_SRC  = path.join(__dirname, 'cpid-auto-merge.json');
const REVIEW_SRC      = path.join(__dirname, 'cpid-review-queue.json');
const PENDING_DEST    = path.join(ROOT, 'src', 'data', 'cpid-pending-merges.json');
const REVIEW_DEST     = path.join(ROOT, 'src', 'data', 'cpid-review-queue.json');

// Strip ": Master-CMxxxx" suffix from a group name
function cleanName(name) {
  return name.replace(/:\s*Master-CM\d+$/, '').trim();
}

// --- cpid-pending-merges.json ---
const rawMerges = JSON.parse(fs.readFileSync(AUTO_MERGE_SRC, 'utf8'));

const filtered = rawMerges.filter((pair) => {
  // Filter out Master-Unmatched on either side
  if (pair.groupA.id === 'Master-Unmatched' || pair.groupB.id === 'Master-Unmatched') {
    return false;
  }
  // Filter out known false positive: DENTAL WHALE vs MARIGOLD (groupA.id === Master-CM1486131)
  if (pair.groupA.id === 'Master-CM1486131') {
    return false;
  }
  return true;
});

const pendingMerges = filtered.map((pair) => {
  const { groupA, groupB, score, reason } = pair;

  // Use the name from whichever group has higher pyQ1
  const winnerName = groupA.pyQ1 >= groupB.pyQ1
    ? cleanName(groupA.name)
    : cleanName(groupB.name);

  return {
    id: groupA.id,
    mergeId: groupB.id,
    name: winnerName,
    childIds: [groupA.childId, groupB.childId],
    class2: 'Private Practice',
    source: 'auto-merge',
    score,
    reason,
    groupAName: cleanName(groupA.name),
    groupBName: cleanName(groupB.name),
    addr: `${groupA.addr}, ${groupA.city} ${groupA.st}`,
  };
});

fs.writeFileSync(PENDING_DEST, JSON.stringify(pendingMerges, null, 2), 'utf8');
console.log(`Wrote ${pendingMerges.length} entries to ${PENDING_DEST}`);

// --- cpid-review-queue.json (verbatim copy) ---
const reviewQueue = JSON.parse(fs.readFileSync(REVIEW_SRC, 'utf8'));
fs.writeFileSync(REVIEW_DEST, JSON.stringify(reviewQueue, null, 2), 'utf8');
console.log(`Wrote ${reviewQueue.length} entries to ${REVIEW_DEST}`);
