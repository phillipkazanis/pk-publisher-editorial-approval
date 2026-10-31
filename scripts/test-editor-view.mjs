// Tests for lib/editor-view.js (pure functions, no database or network). Run: npm run test:editor
import assert from 'node:assert/strict';
import { parseBannedTerms, excerptsIn, highlightSegments, aiFindings, aiVerdictKind, taskStatus, wordCountState } from '../lib/editor-view.js';

// Banned terms come from the DMN reason text
assert.deepEqual(parseBannedTerms('Article contains banned terms: miracle cure, guaranteed'), ['miracle cure', 'guaranteed']);
assert.deepEqual(parseBannedTerms('Article is 900 words, over the maximum of 800.'), []);
assert.deepEqual(parseBannedTerms(null), []);

// Excerpts: exact passages only
const body = 'The council voted on Tuesday. The first stage begins in March. A spokesperson said "we are pleased" today.';
assert.deepEqual(excerptsIn('The first stage begins in March.', body), ['The first stage begins in March.']);
assert.deepEqual(excerptsIn('The first stage begins in March', body), ['The first stage begins in March']); // no full stop in the finding is fine
assert.deepEqual(excerptsIn('HL-2: the claim "we are pleased" has no named source', body), ['we are pleased']);
assert.deepEqual(excerptsIn('the first stage begins in march.', body), []); // case differs: no guess
assert.deepEqual(excerptsIn('The headline is a question.', body), []);
assert.deepEqual(excerptsIn('"a"', 'a b c'), []); // too short to highlight

// Segments never lose or alter text, and merge overlaps
const segs = highlightSegments(body, ['first stage begins', 'stage begins in March.']);
assert.equal(segs.map((s) => s.text).join(''), body);
assert.deepEqual(segs.filter((s) => s.mark).map((s) => s.text), ['first stage begins in March.']);
assert.deepEqual(highlightSegments(body, []), [{ text: body, mark: false }]);
const html = '<img src=x onerror=alert(1)> <b>bold</b>';
assert.equal(highlightSegments(html, ['bold']).map((s) => s.text).join(''), html); // text stays text

// Findings: severity by list, matched only with an exact excerpt
const f = aiFindings({ articleBody: body, aiReasons: ['HL-1: bad'], aiWarnings: ['Check "we are pleased"'], claimsNeedingSources: ['The first stage begins in March.'] });
assert.deepEqual(f.map((x) => [x.kind, x.matched]), [['reason', false], ['warning', true], ['claim', true]]);

// Verdicts and status chip
assert.equal(aiVerdictKind('PASS'), 'pass');
assert.equal(aiVerdictKind('fail - reasons'), 'fail');
assert.equal(aiVerdictKind('Maybe'), 'other');
assert.equal(aiVerdictKind(null), 'none');
const clean = { rulesVerdict: 'PASS', aiVerdict: 'PASS', aiReasons: [], aiWarnings: [], claimsNeedingSources: ['x'] };
assert.equal(taskStatus(clean).key, 'pass'); // claims alone are informational
assert.equal(taskStatus({ ...clean, aiWarnings: ['w'] }).key, 'attention');
assert.equal(taskStatus({ ...clean, rulesVerdict: 'FAIL' }).key, 'attention');
assert.equal(taskStatus({ aiReasons: [], aiWarnings: [] }).key, 'none');

// Word count against limits
const limits = { maxWordCount: 800, minWordCount: 100 };
assert.deepEqual([wordCountState(500, limits), wordCountState(900, limits), wordCountState(50, limits), wordCountState(500, null), wordCountState(null, limits)], ['ok', 'over', 'under', 'unknown', 'unknown']);

console.log('editor view tests passed');
