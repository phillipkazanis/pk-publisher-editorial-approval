// Tests for lib/article-stats.js (pure function, no database or network). Run: npm run test:stats
import assert from 'node:assert/strict';
import { articleStats } from '../lib/article-stats.js';

const empty = articleStats(null, '');
assert.deepEqual([empty.words, empty.sentences, empty.paragraphs, empty.readMinutes, empty.headlineChars], [0, 0, 0, 0, 0]);

const body = 'The council voted on Tuesday. A spokesperson said "we are pleased" and the plan costs 12 million.\n\nWork starts in March, according to the report. Is that soon? Yes.';
const s = articleStats('Council approves plan', body);
assert.equal(s.sentences, 5);
assert.equal(s.paragraphs, 2);
assert.equal(s.quotes, 1);
assert.equal(s.attributions, 3); // said, spokesperson, according to
assert.equal(s.figures, 1);
assert.equal(s.readMinutes, 1);
assert.equal(s.headlineWords, 3);
assert.equal(s.headlineChars, 21);
assert.equal(s.words, body.split(/\s+/).filter(Boolean).length);
assert.ok(s.longestSentenceWords >= s.avgSentenceWords);

assert.equal(articleStats('x', 'a '.repeat(401)).readMinutes, 3); // 401 words at 200 a minute rounds up
assert.equal(articleStats('x', '“Curly quotes” and “more”.').quotes, 2);
console.log('article stats tests passed');
