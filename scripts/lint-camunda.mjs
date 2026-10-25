// Lints the BPMN, DMN and form in camunda/ (or the directory given as the first argument).
// Report only: this script never edits files. Exits 1 when any error is found.
// Needs xmllint (built into macOS) for XML well-formedness.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'camunda';
const findings = [];
const report = (level, file, msg) => findings.push({ level, file, msg });

// ---- minimal XML tree (the files are checked for well-formedness by xmllint first) ----
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;|&#34;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&');
function parseXml(xml) {
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([^\s>\/]+)((?:\s+[^\s=>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let last = 0, m;
  while ((m = re.exec(xml))) {
    stack.at(-1).text += xml.slice(last, m.index);
    last = re.lastIndex;
    if (m[2] === undefined) continue;
    if (m[1]) { stack.pop(); continue; }
    const attrs = {};
    for (const a of m[3].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3]);
    const node = { name: m[2].replace(/^[^:]*:/, ''), attrs, children: [], text: '' };
    stack.at(-1).children.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}
const walk = (n, fn) => { fn(n); n.children.forEach((c) => walk(c, fn)); };
const all = (n, name) => { const out = []; walk(n, (x) => x.name === name && out.push(x)); return out; };
const child = (n, name) => n.children.find((c) => c.name === name);
const feelTexts = (n) => { const out = []; walk(n, (x) => { if (x.name === 'conditionExpression' || x.name === 'text' || x.name === 'timeDuration') out.push(x.text.trim()); Object.entries(x.attrs).forEach(([k, v]) => { if (k === 'source' && v.startsWith('=')) out.push(v); }); }); return out; };

function xmllint(file) {
  try {
    execFileSync('xmllint', ['--noout', file], { stdio: 'pipe' });
    return true;
  } catch (e) {
    const msg = e.code === 'ENOENT' ? 'xmllint not found on PATH' : String(e.stderr || e.message).trim().split('\n')[0];
    report('error', file, `not well-formed XML: ${msg}`);
    return false;
  }
}

const files = readdirSync(dir).map((f) => join(dir, f));
const bpmnFile = files.find((f) => f.endsWith('.bpmn'));
const dmnFile = files.find((f) => f.endsWith('.dmn'));
const formFile = files.find((f) => f.endsWith('.form'));
for (const [kind, f] of [['BPMN', bpmnFile], ['DMN', dmnFile], ['form', formFile]]) if (!f) report('error', dir, `no ${kind} file found`);

let bpmn, dmn, form;
if (bpmnFile && xmllint(bpmnFile)) bpmn = parseXml(readFileSync(bpmnFile, 'utf8'));
if (dmnFile && xmllint(dmnFile)) dmn = parseXml(readFileSync(dmnFile, 'utf8'));
if (formFile) {
  try { form = JSON.parse(readFileSync(formFile, 'utf8')); } catch (e) { report('error', formFile, `invalid JSON: ${e.message}`); }
}

const listComprehension = /\bfor\s+\w+\s+in\b/;
const secretLike = /eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|sb_secret_\w+|AKIA[A-Z0-9]{12,}/;

// ---- BPMN ----
if (bpmn) {
  const f = bpmnFile;
  const process_ = all(bpmn, 'process')[0];
  const ids = {};
  walk(bpmn, (n) => { if (n.attrs.id) { (ids[n.attrs.id] ||= []).push(n.name); } });
  Object.entries(ids).filter(([, v]) => v.length > 1).forEach(([id]) => report('error', f, `duplicate id "${id}"`));

  // flat process, with one deliberate exception: the AI Agent sub-process (an ad-hoc sub-process run by the AI Agent connector)
  const taskType = (n) => child(child(n, 'extensionElements') || { children: [] }, 'taskDefinition')?.attrs.type || '';
  const isAgent = (n) => /^io\.camunda\.agenticai:aiagent[:-]/.test(taskType(n));
  for (const bad of ['subProcess', 'adHocSubProcess', 'transaction', 'callActivity']) {
    all(process_, bad)
      .filter((n) => !(bad === 'adHocSubProcess' && isAgent(n)))
      .forEach((n) => report('error', f, `${bad} "${n.attrs.id}" breaks the flat-process rule`));
  }

  // user tasks
  for (const t of all(process_, 'userTask').filter((n) => n.attrs.id)) { // skip the <zeebe:userTask /> marker, which has no id
    const ext = child(t, 'extensionElements');
    if (!ext || !child(ext, 'userTask')) report('error', f, `userTask "${t.attrs.id}" is missing <zeebe:userTask />`);
    const assign = ext && child(ext, 'assignmentDefinition');
    if (!assign?.attrs.candidateGroups) report('error', f, `userTask "${t.attrs.id}" has no candidateGroups`);
    if (assign?.attrs.assignee) report('warn', f, `userTask "${t.attrs.id}" sets assignee; the rule is candidateGroups`);
  }

  // flows
  const flows = all(process_, 'sequenceFlow');
  const elementIds = new Set(); walk(process_, (n) => n.attrs.id && elementIds.add(n.attrs.id));
  for (const fl of flows) {
    if (!elementIds.has(fl.attrs.sourceRef)) report('error', f, `flow "${fl.attrs.id}" has unknown sourceRef`);
    if (!elementIds.has(fl.attrs.targetRef)) report('error', f, `flow "${fl.attrs.id}" has unknown targetRef`);
    if (fl.attrs.sourceRef === fl.attrs.targetRef) report('error', f, `flow "${fl.attrs.id}" is self-referencing`);
  }

  // AI Agent sub-process: bounded loop, documented tools without sequence flows, an output mapping
  for (const agent of all(process_, 'adHocSubProcess').filter(isAgent)) {
    const aid = agent.attrs.id;
    report('warn', f, `adHocSubProcess "${aid}" is the AI Agent sub-process: an intentional exception to the flat-process rule`);
    const mapping = child(child(agent, 'extensionElements') || { children: [] }, 'ioMapping');
    const inputs = mapping ? mapping.children.filter((c) => c.name === 'input') : [];
    const max = inputs.find((i) => i.attrs.target === 'data.limits.maxModelCalls');
    const maxN = max ? Number(String(max.attrs.source).replace(/^=/, '')) : NaN;
    if (!(maxN >= 1 && maxN <= 10)) report('error', f, `agent "${aid}" must bound its loop with data.limits.maxModelCalls between 1 and 10`);
    if (!mapping || !mapping.children.some((c) => c.name === 'output' && c.attrs.target)) report('error', f, `agent "${aid}" has no output mapping for its result`);
    const tools = agent.children.filter((c) => /Task$|^callActivity$/.test(c.name));
    if (!tools.length) report('error', f, `agent "${aid}" has no tools`);
    for (const tool of tools) {
      if (!child(tool, 'documentation')?.text.trim()) report('error', f, `tool "${tool.attrs.id}" needs documentation: the model reads it as the tool description`);
      if (flows.some((fl) => fl.attrs.sourceRef === tool.attrs.id || fl.attrs.targetRef === tool.attrs.id)) report('error', f, `tool "${tool.attrs.id}" must not have sequence flows`);
    }
    const jsonFormat = inputs.some((i) => i.attrs.target === 'data.response.format.type' && i.attrs.source === 'json');
    if (jsonFormat && flows.some((fl) => /responseText/.test(child(fl, 'conditionExpression')?.text || ''))) report('error', f, `agent "${aid}" returns JSON but a gateway still reads responseText`);
  }

  // exclusive gateways: default flow
  for (const g of all(process_, 'exclusiveGateway')) {
    const outgoing = flows.filter((fl) => fl.attrs.sourceRef === g.attrs.id);
    if (outgoing.length > 1) {
      const def = g.attrs.default;
      if (!def) report('error', f, `exclusiveGateway "${g.attrs.id}" has no default flow`);
      else if (!outgoing.some((fl) => fl.attrs.id === def)) report('error', f, `exclusiveGateway "${g.attrs.id}" default "${def}" is not one of its outgoing flows`);
      outgoing.filter((fl) => fl.attrs.id !== def && !child(fl, 'conditionExpression'))
        .forEach((fl) => report('error', f, `flow "${fl.attrs.id}" leaves an exclusive gateway with no condition and is not the default`));
    }
  }

  // event-based gateways must lead to catch events
  for (const g of all(process_, 'eventBasedGateway')) {
    for (const fl of flows.filter((x) => x.attrs.sourceRef === g.attrs.id)) {
      const target = all(process_, 'intermediateCatchEvent').find((e) => e.attrs.id === fl.attrs.targetRef);
      if (!target) report('error', f, `eventBasedGateway "${g.attrs.id}" flow "${fl.attrs.id}" does not lead to an intermediate catch event`);
    }
  }

  // messages: native events, unique names, correlation key
  const messages = all(bpmn, 'message');
  const names = messages.map((m) => m.attrs.name);
  names.filter((n, i) => names.indexOf(n) !== i).forEach((n) => report('error', f, `message name "${n}" is used by more than one message`));
  for (const m of messages) {
    const sub = all(m, 'subscription')[0];
    if (!sub?.attrs.correlationKey) report('error', f, `message "${m.attrs.name}" has no correlationKey subscription`);
  }
  for (const def of all(process_, 'messageEventDefinition')) {
    if (!messages.some((m) => m.attrs.id === def.attrs.messageRef)) report('error', f, `messageEventDefinition references unknown message "${def.attrs.messageRef}"`);
  }
  // Camunda only merges message variables that an output mapping names once any output mapping exists.
  // So a catch event with output mappings must map every payload variable the app publishes, or the new content is silently dropped.
  try {
    const src = readFileSync('pages/api/resubmit.js', 'utf8');
    const payload = (src.match(/variables:\s*\{([^}]*)\}/)?.[1] || '').split(',').map((p) => p.split(':')[0].trim()).filter(Boolean);
    for (const ev of all(process_, 'intermediateCatchEvent').filter((e) => child(e, 'messageEventDefinition'))) {
      const outputs = child(child(ev, 'extensionElements') || { children: [] }, 'ioMapping')?.children.filter((c) => c.name === 'output') || [];
      if (!outputs.length) continue;
      const mapped = outputs.map((o) => o.attrs.target);
      const missingPayload = payload.filter((k) => k !== 'submissionId' && !mapped.includes(k));
      if (missingPayload.length) report('error', f, `message catch event "${ev.attrs.id}" has output mappings but does not map ${missingPayload.join(', ')}: Camunda discards unmapped message variables, so a resubmission would be ignored`);
    }
  } catch {
    report('warn', f, 'could not read pages/api/resubmit.js to check that message output mappings carry the payload');
  }

  // Send Message connector: heuristic on task type, template id and task name
  walk(process_, (n) => {
    if (n.name === 'taskDefinition' && /send.?message|:message:|publish.?message/i.test(n.attrs.type || '')) report('error', f, `task type "${n.attrs.type}" looks like the Send Message connector; use native message events`);
    if (n.attrs['zeebe:modelerTemplate'] && /message/i.test(n.attrs['zeebe:modelerTemplate'])) report('error', f, `"${n.attrs.id}" uses message template "${n.attrs['zeebe:modelerTemplate']}"; use native message events`);
  });

  // FEEL list comprehensions and secrets
  feelTexts(bpmn).forEach((t) => { if (listComprehension.test(t)) report('error', f, `FEEL list comprehension: ${t.slice(0, 80)}`); });
  const rawBpmn = readFileSync(f, 'utf8');
  const leaked = rawBpmn.match(secretLike);
  if (leaked) report('error', f, `possible literal secret in file (matched "${leaked[0].slice(0, 6)}...")`); // never print more than the prefix
  for (const n of all(bpmn, 'input')) { // connector secrets should be {{secrets.X}} references
    if (/(access|secret).*key|password|\btoken\b/i.test(n.attrs.target || '') && n.attrs.source && !/\{\{secrets\.[A-Z0-9_]+\}\}/.test(n.attrs.source)) {
      report('warn', f, `input "${n.attrs.target}" looks like a credential but is not a {{secrets.X}} reference`);
    }
  }

  // DI coverage
  const di = all(bpmn, 'BPMNShape').concat(all(bpmn, 'BPMNEdge'));
  di.filter((d) => !elementIds.has(d.attrs.bpmnElement)).forEach((d) => report('error', f, `diagram shape "${d.attrs.id}" points at unknown element "${d.attrs.bpmnElement}"`));
  const shaped = new Set(di.map((d) => d.attrs.bpmnElement));
  const shapeable = ['startEvent', 'endEvent', 'serviceTask', 'userTask', 'businessRuleTask', 'exclusiveGateway', 'eventBasedGateway', 'intermediateCatchEvent', 'adHocSubProcess', 'sequenceFlow'];
  shapeable.flatMap((k) => all(process_, k)).filter((n) => n.attrs.id && !shaped.has(n.attrs.id)).forEach((n) => report('warn', f, `${n.name} "${n.attrs.id}" has no diagram shape`));

  // cross-file and cross-code references
  const procId = process_.attrs.id;
  try {
    const startSrc = readFileSync('pages/api/start-process.js', 'utf8');
    const used = startSrc.match(/processDefinitionId:\s*'([^']+)'/)?.[1];
    if (used && used !== procId) report('error', f, `process id "${procId}" does not match start-process.js processDefinitionId "${used}"`);
  } catch { report('warn', f, 'could not read pages/api/start-process.js to cross-check the process id'); }
  const formRefs = all(process_, 'formDefinition').map((n) => n.attrs.formId).filter(Boolean);
  if (form) formRefs.filter((id) => id !== form.id).forEach((id) => report('error', f, `formId "${id}" does not match form id "${form.id}"`));
  if (dmn) {
    const decisionIds = all(dmn, 'decision').map((d) => d.attrs.id);
    all(process_, 'calledDecision').forEach((c) => { if (!decisionIds.includes(c.attrs.decisionId)) report('error', f, `calledDecision "${c.attrs.decisionId}" not found in DMN (has: ${decisionIds.join(', ')})`); });
  }
  if (form) { // variables the gateways read from the user task must be form keys
    const keys = new Set(flattenForm(form.components).map((c) => c.key).filter(Boolean));
    const approvalCond = flows.map((fl) => child(fl, 'conditionExpression')?.text || '').join(' ');
    if (/\bapprovalDecision\b/.test(approvalCond) && !keys.has('approvalDecision')) report('error', f, 'gateway reads approvalDecision but the form has no field with that key');
  }
}

// ---- DMN ----
if (dmn) {
  const f = dmnFile;
  const tables = all(dmn, 'decisionTable');
  if (!tables.length) report('error', f, 'no decisionTable found');
  for (const t of tables) {
    const nIn = t.children.filter((c) => c.name === 'input').length;
    const nOut = t.children.filter((c) => c.name === 'output').length;
    if (!t.attrs.hitPolicy) report('warn', f, `decisionTable "${t.attrs.id}" has no explicit hitPolicy`);
    for (const r of t.children.filter((c) => c.name === 'rule')) {
      const i = r.children.filter((c) => c.name === 'inputEntry').length;
      const o = r.children.filter((c) => c.name === 'outputEntry').length;
      if (i !== nIn || o !== nOut) report('error', f, `rule "${r.attrs.id}" has ${i} input and ${o} output entries; table has ${nIn} and ${nOut}`);
    }
  }
  all(dmn, 'text').forEach((n) => { if (listComprehension.test(n.text)) report('error', f, `FEEL list comprehension: ${n.text.trim().slice(0, 80)}`); });
  if (!all(dmn, 'decision').some((d) => d.attrs.id)) report('error', f, 'decision has no id');
  // heuristic: banned-word match lowercases the article but not the term
  all(dmn, 'text').filter((n) => /contains\(lower case\(/.test(n.text) && !/lower case\(item\)/.test(n.text))
    .forEach(() => report('warn', f, 'banned-word match lowercases articleBody but not the banned term; mixed-case terms in the table will never match'));
}

// ---- form ----
function flattenForm(components = []) { return components.flatMap((c) => [c, ...flattenForm(c.components)]); }
if (form) {
  const f = formFile;
  const comps = flattenForm(form.components);
  const keys = comps.map((c) => c.key).filter(Boolean);
  keys.filter((k, i) => keys.indexOf(k) !== i).forEach((k) => report('error', f, `duplicate field key "${k}"`));
  const ids = comps.map((c) => c.id).filter(Boolean);
  ids.filter((k, i) => ids.indexOf(k) !== i).forEach((k) => report('error', f, `duplicate component id "${k}"`));
  if (!form.id) report('error', f, 'form has no id');
  if (!form.schemaVersion) report('warn', f, 'form has no schemaVersion');
}

// ---- output ----
const errors = findings.filter((x) => x.level === 'error');
const warns = findings.filter((x) => x.level === 'warn');
for (const x of [...errors, ...warns]) console.log(`${x.level.toUpperCase().padEnd(5)} ${x.file}: ${x.msg}`);
console.log(`\nChecked ${dir}: ${errors.length} error(s), ${warns.length} warning(s). No files were modified.`);
process.exit(errors.length ? 1 : 0);
