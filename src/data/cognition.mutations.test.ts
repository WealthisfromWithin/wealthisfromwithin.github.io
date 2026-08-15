import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createKernel, createStubKernel, type LLMProvider } from '@/agents';
import { SovereignDb } from './db';
import { readDataset } from './repositories';
import { clearDemoData, ensureSeeded, seedDemoData } from './repositories';
import {
  answerResearchItem,
  archiveKnowledgeNode,
  captureKnowledgeNode,
  captureResearchItem,
  confirmMemoryEntry,
  createDocument,
  decideDecision,
  promptVariables,
  recallMemoryEntry,
  recordDecision,
  recordPromptUse,
  recordResearchFinding,
  retireMemoryEntry,
  reviewKnowledgeNode,
  runAgentTurn,
  saveMemoryEntry,
  savePrompt,
  setDecisionStatus,
  setDocumentStatus,
  setKnowledgePinned,
  setMemoryPinned,
  setResearchStatus,
  startAgentSession,
  supersedeDecision,
} from './mutations';
import { DAY_MS } from '@/lib/clock';

const DECIDED = 'dec-no-discount';
const PROPOSED = 'dec-editor-hire';
const SUPERSEDED = 'dec-weekly-cadence';
const STALE_MEMORY = 'mem-kestrel-lesson';
const RETIRED_MEMORY = 'mem-retired-intro-rate';
const DRAFT_DOC = 'doc-advisory-sop';
const OPEN_QUESTION = 'res-retainer-benchmarks';
const ANSWERED_QUESTION = 'res-linkedin-format';
const PROMPT = 'pr-copy-critique';
const SESSION = 'ags-renewal-memo';
const NODE = 'kn-truoak-decision-style';

let dbName = '';
let database: SovereignDb;

/** Closes the instance and opens a fresh one on the same data, as a page reload does. */
async function reload(): Promise<SovereignDb> {
  database.close();
  database = new SovereignDb(dbName);
  await database.open();
  return database;
}

beforeEach(async () => {
  dbName = `sovereign-cognition-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
  database = new SovereignDb(dbName);
  await database.open();
  await ensureSeeded(database, new Date());
});

afterEach(async () => {
  await database.delete();
  database.close();
});

describe('knowledge writes', () => {
  it('captures a node as local, not demo, and records the event', async () => {
    const node = await captureKnowledgeNode({ title: '  Retainers renew on proof  ' }, database);

    expect(node?.title).toBe('Retainers renew on proof');
    expect(node?.source).toBe('local');
    expect(node?.touchedAt).toBe(node?.createdAt);

    const events = await database.events.toArray();
    expect(events.some((event) => event.title.startsWith('Knowledge captured:'))).toBe(true);
  });

  it('refuses a node with no title rather than writing an untitled row', async () => {
    expect(await captureKnowledgeNode({ title: '   ' }, database)).toBeNull();
  });

  it('pins, reviews, and archives without deleting anything', async () => {
    expect(await setKnowledgePinned(NODE, true, database)).toBe(true);
    expect(await reviewKnowledgeNode(NODE, database)).toBe(true);
    expect(await archiveKnowledgeNode(NODE, true, database)).toBe(true);

    const node = await database.knowledgeNodes.get(NODE);
    expect(node?.archivedAt).toBeDefined();
    expect(node?.reviewedAt).toBeDefined();
    // Archiving takes the node out of the working set, so the pin goes with it.
    expect(node?.pinned).toBe(false);
  });

  it('survives a reload and a demo reseed', async () => {
    const node = await captureKnowledgeNode({ title: 'Local knowledge' }, database);
    await seedDemoData(database, new Date(Date.now() + DAY_MS));

    const reopened = await reload();
    expect(await reopened.knowledgeNodes.get(node?.id ?? '')).toBeDefined();
  });

  it('survives the demo opt-out, because it was never demo data', async () => {
    const node = await captureKnowledgeNode({ title: 'Local knowledge' }, database);
    await clearDemoData(database);

    const dataset = await readDataset(database);
    expect(dataset.knowledgeNodes.map((row) => row.id)).toEqual([node?.id]);
    expect(dataset.decisions).toHaveLength(0);
    expect(dataset.agentMessages).toHaveLength(0);
  });
});

describe('memory writes', () => {
  it('counts a recall and stamps when it happened', async () => {
    const before = await database.memoryEntries.get(STALE_MEMORY);
    expect(await recallMemoryEntry(STALE_MEMORY, database)).toBe(true);

    const after = await database.memoryEntries.get(STALE_MEMORY);
    expect(after?.recallCount).toBe((before?.recallCount ?? 0) + 1);
    expect(after?.lastRecalledAt).toBeDefined();
  });

  it('pushes the review date out when a memory is re-confirmed', async () => {
    const now = new Date();
    expect(await confirmMemoryEntry(STALE_MEMORY, 90, database, now)).toBe(true);

    const entry = await database.memoryEntries.get(STALE_MEMORY);
    expect(Date.parse(entry?.reviewAt ?? '')).toBeGreaterThan(now.getTime());
  });

  it('retires rather than deletes, and can restore', async () => {
    expect(await retireMemoryEntry(STALE_MEMORY, true, database)).toBe(true);
    expect((await database.memoryEntries.get(STALE_MEMORY))?.retiredAt).toBeDefined();

    expect(await retireMemoryEntry(RETIRED_MEMORY, false, database)).toBe(true);
    expect((await database.memoryEntries.get(RETIRED_MEMORY))?.retiredAt).toBeUndefined();
  });

  it('reports no change when the memory is already in that state', async () => {
    expect(await retireMemoryEntry(RETIRED_MEMORY, true, database)).toBe(false);
    expect(await recallMemoryEntry('mem-nope', database)).toBe(false);
  });

  it('refuses an empty statement and keeps a pin off a retired entry', async () => {
    expect(await saveMemoryEntry({ statement: '  ' }, database)).toBeNull();
    expect(await setMemoryPinned('mem-nope', true, database)).toBe(false);
  });
});

describe('document writes', () => {
  it('creates a draft owned by the operator', async () => {
    const document = await createDocument({ title: 'Pricing note', body: '# Note' }, database);

    expect(document?.status).toBe('draft');
    expect(document?.source).toBe('local');
    expect(document?.author).toBe('Operator');
  });

  it('moves a draft to final and back to archived', async () => {
    expect((await setDocumentStatus(DRAFT_DOC, 'final', database)).ok).toBe(true);
    expect((await database.documents.get(DRAFT_DOC))?.status).toBe('final');

    expect((await setDocumentStatus(DRAFT_DOC, 'archived', database)).ok).toBe(true);
    expect((await database.documents.get(DRAFT_DOC))?.status).toBe('archived');
  });

  it('says why rather than failing silently', async () => {
    expect(await setDocumentStatus('doc-nope', 'final', database)).toEqual({
      ok: false,
      reason: expect.stringContaining('local store'),
    });
    expect((await setDocumentStatus(DRAFT_DOC, 'draft', database)).ok).toBe(false);
  });
});

describe('decision writes', () => {
  it('records a call with an answer as decided, and one without as proposed', async () => {
    const open = await recordDecision({ title: 'Raise the floor?' }, database);
    const made = await recordDecision(
      { title: 'Hold the cadence', choice: 'One essay a week', rationale: 'Depth converts' },
      database,
    );

    expect(open?.status).toBe('proposed');
    expect(open?.decidedAt).toBeUndefined();
    expect(made?.status).toBe('decided');
    expect(made?.decidedBy).toBe('Operator');
  });

  it('will not record a decision without the choice', async () => {
    const result = await decideDecision(PROPOSED, { choice: '   ' }, database);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('choice');
    expect((await database.decisions.get(PROPOSED))?.status).toBe('proposed');
  });

  it('makes the call and keeps the reasoning with it', async () => {
    const result = await decideDecision(
      PROPOSED,
      { choice: 'Hire a part-time editor', rationale: 'The second draft is the bottleneck.' },
      database,
    );

    expect(result.ok).toBe(true);
    const decision = await database.decisions.get(PROPOSED);
    expect(decision?.status).toBe('decided');
    expect(decision?.rationale).toContain('bottleneck');
    expect(decision?.decidedAt).toBeDefined();
  });

  it('routes deciding and superseding through their own writers', async () => {
    expect((await setDecisionStatus(PROPOSED, 'decided', database)).reason).toContain(
      'decideDecision',
    );
    expect((await setDecisionStatus(PROPOSED, 'superseded', database)).reason).toContain(
      'supersedeDecision',
    );
  });

  it('reopens a decided call and clears its decision stamp', async () => {
    expect((await setDecisionStatus(DECIDED, 'proposed', database)).ok).toBe(true);

    const decision = await database.decisions.get(DECIDED);
    expect(decision?.status).toBe('proposed');
    expect(decision?.decidedAt).toBeUndefined();
    // The choice stays on the record as what was decided before.
    expect(decision?.choice.length).toBeGreaterThan(0);
  });

  it('keeps closed history closed', async () => {
    expect((await setDecisionStatus(SUPERSEDED, 'proposed', database)).ok).toBe(false);
    expect((await supersedeDecision(SUPERSEDED, DECIDED, database)).ok).toBe(false);
  });

  it('links both ends of a supersession and refuses a self-reference', async () => {
    expect((await supersedeDecision(DECIDED, DECIDED, database)).reason).toContain('itself');
    expect((await supersedeDecision(DECIDED, 'dec-nope', database)).ok).toBe(false);

    expect((await supersedeDecision(DECIDED, 'dec-local-first', database)).ok).toBe(true);
    const decision = await database.decisions.get(DECIDED);
    expect(decision?.status).toBe('superseded');
    expect(decision?.supersededById).toBe('dec-local-first');
  });
});

describe('prompt writes', () => {
  it('reads the variables off the body, so the two cannot disagree', () => {
    expect(promptVariables('Draft for {{audience}} about {{topic}} for {{audience}}.')).toEqual([
      'audience',
      'topic',
    ]);
    expect(promptVariables('No variables.')).toEqual([]);
  });

  it('saves a prompt with its variables and refuses an empty body', async () => {
    const prompt = await savePrompt({ title: 'Draft', body: 'Write for {{who}}.' }, database);

    expect(prompt?.variables).toEqual(['who']);
    expect(prompt?.useCount).toBe(0);
    expect(await savePrompt({ title: 'Draft', body: '  ' }, database)).toBeNull();
  });

  it('counts a use without recording anything a model said', async () => {
    expect(await recordPromptUse(PROMPT, database)).toBe(true);

    const prompt = await database.prompts.get(PROMPT);
    expect(prompt?.useCount).toBe(1);
    expect(prompt?.lastUsedAt).toBeDefined();
    expect(await database.agentMessages.where('sessionId').equals(PROMPT).count()).toBe(0);
  });
});

describe('research writes', () => {
  it('queues a question with no findings and no answer', async () => {
    const item = await captureResearchItem({ question: 'What renews?' }, database);

    expect(item?.status).toBe('queued');
    expect(item?.findings).toEqual([]);
    expect(item?.answer).toBe('');
    expect(await captureResearchItem({ question: '  ' }, database)).toBeNull();
  });

  it('makes a queued question active as soon as a finding is recorded', async () => {
    const result = await recordResearchFinding(
      OPEN_QUESTION,
      'Two comparable retainers publish their rate.',
      'Public pricing pages',
      database,
    );

    expect(result.ok).toBe(true);
    const item = await database.researchItems.get(OPEN_QUESTION);
    expect(item?.status).toBe('active');
    expect(item?.findings).toHaveLength(1);
    expect(item?.findings[0]?.source).toBe('Public pricing pages');
  });

  it('refuses an empty finding or an empty answer', async () => {
    expect((await recordResearchFinding(OPEN_QUESTION, '   ', '', database)).ok).toBe(false);
    expect((await answerResearchItem(OPEN_QUESTION, '  ', database)).ok).toBe(false);
  });

  it('will not mark a question answered without the answer', async () => {
    const result = await setResearchStatus(OPEN_QUESTION, 'answered', database);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('answerResearchItem');
  });

  it('records the answer with its date, and clears the date when reopened', async () => {
    expect((await answerResearchItem(OPEN_QUESTION, 'Between 4k and 7k.', database)).ok).toBe(true);
    expect((await database.researchItems.get(OPEN_QUESTION))?.answeredAt).toBeDefined();

    expect((await setResearchStatus(ANSWERED_QUESTION, 'active', database)).ok).toBe(true);
    const reopened = await database.researchItems.get(ANSWERED_QUESTION);
    expect(reopened?.answeredAt).toBeUndefined();
    // The text stays visible as the answer that was withdrawn.
    expect(reopened?.answer.length).toBeGreaterThan(0);
  });
});

describe('agent turns', () => {
  function provider(text: string): LLMProvider {
    return {
      id: 'local',
      label: 'Local model',
      external: false,
      health: () =>
        Promise.resolve({
          id: 'local',
          label: 'Local model',
          state: 'ready',
          reachable: true,
          external: false,
          detail: '',
        }),
      complete: () =>
        Promise.resolve({
          ok: true,
          generated: true,
          provider: 'local',
          text,
          requiresApproval: true,
        }),
    };
  }

  it('opens a session and counts the prompt it started from', async () => {
    const session = await startAgentSession(
      { title: 'Critique the launch copy', promptId: PROMPT, opening: 'Here is the copy.' },
      database,
    );

    expect(session?.unansweredCount).toBe(0);
    expect((await database.prompts.get(PROMPT))?.useCount).toBe(1);
    expect(await database.agentMessages.where('sessionId').equals(session?.id ?? '').count()).toBe(
      1,
    );
    expect(await startAgentSession({ title: '  ' }, database)).toBeNull();
  });

  it('writes the refusal into the thread rather than an answer nobody produced', async () => {
    const result = await runAgentTurn(SESSION, 'Draft it.', createStubKernel(), database);

    expect(result.ok).toBe(false);

    const messages = await database.agentMessages.where('sessionId').equals(SESSION).toArray();
    const reply = messages.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    expect(reply?.role).toBe('assistant');
    expect(reply?.outcome).toBe('refused');
    expect(reply?.generated).toBe(false);
    expect(reply?.reason).toBe('no_provider');
    expect(reply?.content).toContain('No model provider is registered');
  });

  it('counts an unanswered turn on the session, so the Brief can see it', async () => {
    const before = await database.agentSessions.get(SESSION);
    await runAgentTurn(SESSION, 'Draft it.', createStubKernel(), database);

    const after = await database.agentSessions.get(SESSION);
    expect(after?.unansweredCount).toBe((before?.unansweredCount ?? 0) + 1);
  });

  it('marks only real provider output as generated, and names the provider', async () => {
    const kernel = createKernel([provider('Here is the memo.')]);
    const result = await runAgentTurn(SESSION, 'Draft it.', kernel, database);

    expect(result.ok).toBe(true);

    const messages = await database.agentMessages.where('sessionId').equals(SESSION).toArray();
    const reply = messages.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    expect(reply?.generated).toBe(true);
    expect(reply?.provider).toBe('local');
    expect(reply?.content).toBe('Here is the memo.');
    expect((await database.agentSessions.get(SESSION))?.unansweredCount).toBe(
      // A turn the kernel ran does not add to the unanswered count.
      1,
    );
  });

  it('refuses an empty turn and an unknown session without writing anything', async () => {
    const before = await database.agentMessages.count();

    expect((await runAgentTurn(SESSION, '   ', createStubKernel(), database)).ok).toBe(false);
    expect((await runAgentTurn('ags-nope', 'hello', createStubKernel(), database)).ok).toBe(false);
    expect(await database.agentMessages.count()).toBe(before);
  });

  it('does not send a previous refusal back to the provider as conversation', async () => {
    const seen: string[] = [];
    const kernel = createKernel([
      {
        ...provider('ok'),
        complete: (request) => {
          seen.push(...request.messages.map((message) => message.content));
          return Promise.resolve({
            ok: true,
            generated: true,
            provider: 'local',
            text: 'ok',
            requiresApproval: true,
          });
        },
      },
    ]);

    await runAgentTurn(SESSION, 'Try again.', kernel, database);

    expect(seen).toContain('Try again.');
    expect(seen.some((content) => content.includes('Awaiting Credentials'))).toBe(false);
  });
});
