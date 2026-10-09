import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localTypeScriptLoader } from './lib/load-local-typescript.mjs';
import { owner, identity, rowsFromRoutine, legacyPplRoutine, embeddedRows } from './fixtures/routine-compatibility.mjs';

let positive = 0, negative = 0;
const check = (label, test) => { try { test(); positive++; } catch (error) { error.message = `${label}: ${error.message}`; throw error; } };
const rejects = (label, test) => { assert.throws(test, undefined, label); negative++; };
const rejectAsync = async (label, test) => { await assert.rejects(async () => await test(), undefined, label); negative++; };
const load = localTypeScriptLoader();
const compatibility = load('src/lib/routine-compatibility.ts');
const model = load('src/lib/routine-model.ts');
const editor = load('src/lib/routine-editor.ts');
const programming = load('src/lib/routine-programming.ts');
const templates = load('src/data/built-in-routine-templates.ts').BUILT_IN_ROUTINE_TEMPLATES;
const intermediate = load('src/lib/routine-templates.ts').materializeRoutineTemplate(templates[2]);
const context = { subjectId: owner, generation: 1, source: 'database' };
const result = (rows, ctx = context) => compatibility.routineLoadResultFromRows(rows, ctx);
const legacyRoutine = legacyPplRoutine(), legacyRows = rowsFromRoutine(legacyRoutine);
const legacy = await result(legacyRows);
check('legacy preserved recoverable graph', () => assert.equal(legacy.status, 'needs_attention'));
check('two blocking structured mismatch issues', () => assert.deepEqual(legacy.issues.map(item => [item.code, item.severity]), [['tracking_unit_mismatch', 'blocking'], ['tracking_unit_mismatch', 'blocking']]));
check('legacy 7/11/0 Sunday Rest', () => assert.deepEqual([legacy.routine.days.length, legacy.routine.days.flatMap(day => day.exercises).length, legacy.routine.days.flatMap(day => day.exercises).filter(item => item.fields.section === 'warmup').length, legacy.routine.days[6].kind], [7, 11, 0, 'rest']));
for (const day of legacyRoutine.days) for (const item of day.exercises) {
  const actual = legacy.routine.days.flatMap(day => day.exercises).find(value => value.id === item.id);
  check('stable occurrence/day identity', () => assert.equal(actual.dayId, day.id));
  for (const field of ['exerciseId', 'name', 'targetMuscle', 'section', 'order', 'targetSets', 'targetValue', 'trackingType', 'weightUnit', 'cardioZone', 'restSeconds', 'note']) check(`preserved ${field}`, () => assert.deepEqual(actual.fields[field], item[field]));
}
check('source detached', () => assert.notStrictEqual(legacy.source.rows.routine, legacyRows.routine));
check('source has SHA evidence and generation', () => assert.equal(legacy.source.fingerprint.length === 64 && legacy.source.generation === 1, true));
rejects('deep immutable snapshot', () => { legacy.source.rows.exercises[0].target_sets = 99; });
check('source retains timestamps and relationships', () => assert.deepEqual(legacy.source.rows, legacyRows));
rejects('unresolved promotion', () => compatibility.promoteRoutineForWrite(legacy.routine));
rejects('read DTO cannot use current serializer', () => model.routinePlanToRpcPayload(legacy.routine));
const badIds = legacy.issues.map(issue => issue.target.occurrenceId);
const corrected = compatibility.correctRecoveryTracking(compatibility.correctRecoveryTracking(legacy.routine, badIds[0], { trackingType: 'reps_weight', weightUnit: 'lbs' }), badIds[1], { trackingType: 'reps_weight', weightUnit: 'plates' });
check('explicit choices promote', () => assert.deepEqual(compatibility.analyzeRoutineCompatibility(corrected), []));
const promoted = compatibility.promoteRoutineForWrite(corrected);
check('only explicit unit fields changed', () => { const expected = structuredClone(legacyRoutine); expected.days[0].exercises[2].weightUnit = 'lbs'; expected.days[1].exercises[2].weightUnit = 'plates'; assert.deepEqual(promoted, expected); });
for (const unit of ['kg', 'lbs', 'plates']) check(`explicit recovery ${unit}`, () => assert.equal(compatibility.correctRecoveryTracking(legacy.routine, badIds[0], { trackingType: 'reps_weight', weightUnit: unit }).days[0].exercises[2].fields.weightUnit, unit));
check('explicit nonweighted choice, not inference', () => assert.equal(compatibility.correctRecoveryTracking(legacy.routine, badIds[0], { trackingType: 'reps_only', weightUnit: 'unitless' }).days[0].exercises[2].fields.trackingType, 'reps_only'));
rejects('recovery cannot create weighted/unitless', () => compatibility.correctRecoveryTracking(legacy.routine, badIds[0], { trackingType: 'reps_weight', weightUnit: 'unitless' }));
check('recovery choices no default', () => assert.deepEqual(compatibility.recoveryProgrammingOptions(legacy.routine, badIds[0], 'reps_weight').units, ['kg', 'lbs', 'plates']));
check('ordinary Add null catalog still no options', () => assert.deepEqual(programming.programmingOptions(undefined, 'reps_weight'), { trackingTypes: [], units: [] }));
rejects('ordinary Add invalid pair', () => editor.addOccurrence(intermediate, intermediate.days[0].id, { ...promoted.days[0].exercises[0], exerciseId: 'vx_ex_bodyweight_squat', trackingType: 'reps_weight', weightUnit: 'unitless' }));
rejects('ordinary Edit invalid pair', () => editor.setOccurrenceTrackingConfig(intermediate, intermediate.days[0].exercises[0].id, { trackingType: 'reps_weight', weightUnit: 'unitless' }));
const current = await result(rowsFromRoutine(intermediate));
check('current Intermediate valid', () => assert.equal(current.status, 'valid'));
check('current serialization identical', () => assert.deepEqual(model.routinePlanToRpcPayload(current.routine), model.routinePlanToRpcPayload(intermediate)));
check('Zone key emitted including null', () => assert(current.routine.days.flatMap(day => model.routinePlanToRpcPayload(current.routine).days.find(value => value.id === day.id).exercises).every(item => Object.hasOwn(item, 'cardioZone'))));
const validRows = rowsFromRoutine(promoted);
const missingIds = await result(validRows);
check('missing canonical IDs valid', () => assert.equal(missingIds.status, 'valid'));

for (const [label, mutate, code] of [
  ['unknown tracking', rows => { rows.exercises[0].tracking_style = 'future_mode'; }, 'unsupported_tracking'],
  ['unknown unit', rows => { rows.exercises[0].weight_unit = 'stones'; }, 'unsupported_unit'],
  ['invalid zone', rows => { rows.exercises[0].cardio_zone = 6; }, 'invalid_zone'],
  ['invalid sets', rows => { rows.exercises[0].target_sets = 0; }, 'invalid_sets'],
  ['invalid rest', rows => { rows.exercises[0].rest_seconds = 0; }, 'invalid_rest'],
  ['invalid target', rows => { rows.exercises[0].target_reps = ''; }, 'invalid_text'],
  ['unknown kind', rows => { rows.days[0].type = 'future_kind'; }, 'unsupported_day_kind'],
  ['populated Rest', rows => { rows.days[0].type = 'rest'; }, 'rest_day_has_occurrences'],
  ['duplicate order', rows => { rows.exercises[1].order_index = 0; }, 'invalid_order'],
  ['oversized note', rows => { rows.exercises[0].note = 'x'.repeat(1001); }, 'invalid_note'],
  ['raw object not inferred', rows => { rows.exercises[0].weight_unit = { legacy: 'kg' }; }, 'unsupported_unit'],
  ['invalid section', rows => { rows.exercises[0].is_warmup = null; }, 'invalid_section'],
]) {
  const rows = structuredClone(validRows); mutate(rows); const actual = await result(rows);
  check(label, () => assert.equal(actual.status, 'needs_attention'));
  check(`${label} issue code`, () => assert(actual.issues.some(item => item.code === code)));
  check(`${label} raw evidence preserved`, () => assert.deepEqual(actual.source.rows, rows));
  rejects(`${label} strict promotion`, () => compatibility.promoteRoutineForWrite(actual.routine));
}
for (const [label, mutate, code] of [
  ['missing weekday', rows => { rows.days.pop(); }, 'weekday_graph'],
  ['duplicate weekday', rows => { rows.days[1].day_name = rows.days[0].day_name; }, 'weekday_graph'],
  ['malformed UUID', rows => { rows.exercises[0].id = 'legacy'; }, 'invalid_identity'],
  ['duplicate day identity', rows => { rows.days[1].id = rows.days[0].id; }, 'duplicate_identity'],
  ['duplicate occurrence identity', rows => { rows.exercises[1].id = rows.exercises[0].id; }, 'duplicate_identity'],
  ['foreign day', rows => { rows.days[0].routine_id = identity(999); }, 'foreign_relationship'],
  ['unmatched occurrence', rows => { rows.exercises[0].routine_day_id = identity(999); }, 'foreign_relationship'],
  ['foreign owner', rows => { rows.routine.user_id = identity(999); }, 'foreign_relationship'],
  ['incomplete rows', rows => { rows.exercises = null; }, 'incomplete_read'],
  ['missing database zone column', rows => { delete rows.exercises[0].cardio_zone; }, 'incomplete_read'],
  ['missing timestamp', rows => { delete rows.days[0].created_at; }, 'incomplete_read'],
]) {
  const rows = structuredClone(validRows); mutate(rows); const actual = await result(rows);
  check(`${label} fatal`, () => assert.equal(actual.status, 'fatal'));
  check(`${label} typed code`, () => assert.equal(actual.error.code, code));
  check(`${label} no fabricated routine`, () => assert.equal(Object.hasOwn(actual, 'routine'), false));
}
const aliasRows = structuredClone(validRows); aliasRows.exercises[0].weight_unit = 'lb'; aliasRows.days[0].day_name = ' MONDAY ';
const alias = await result(aliasRows);
check('registered lb/weekday aliases', () => assert.equal(alias.status, 'valid'));
check('registry source-specific Zone boundary', () => assert.deepEqual(compatibility.ROUTINE_NORMALIZATION_RULES['legacy-absent-zone'], ['legacy-input']));
check('lb normalized but evidence remains lb', () => assert.deepEqual([alias.routine.days[0].exercises[0].weightUnit, alias.source.rows.exercises[0].weight_unit], ['lbs', 'lb']));
const aliasGraph = compatibility.decodeRoutineRowsForRead(aliasRows, context);
const once = compatibility.normalizeKnownLegacyRepresentations(aliasGraph, context), twice = compatibility.normalizeKnownLegacyRepresentations(once.graph, context);
check('normalizer idempotent graph', () => assert.deepEqual(twice.graph, once.graph));
check('no second normalization events', () => assert.equal(twice.normalizations.length, 0));
const absent = structuredClone(validRows); absent.exercises[0].exercise_id = '9003'; absent.exercises[0].note = 'Zone 2. Original note.'; delete absent.exercises[0].cardio_zone;
const old = await result(absent, { ...context, source: 'legacy-input' });
check('pre-zone reviewed legacy boundary', () => assert.equal(old.routine.days[0].exercises[0].cardioZone, 2));
absent.exercises[0].cardio_zone = null;
const explicitNull = await result(absent);
check('explicit null no legacy resurrection', () => assert.equal(explicitNull.routine.days[0].exercises[0].cardioZone, null));
const gap = structuredClone(validRows); gap.exercises.filter(item => item.routine_day_id === gap.days[0].id).forEach((item, i) => { item.order_index = i * 3 + 2; });
const gapResult = await result(gap);
check('unique gaps deterministic', () => assert.equal(gapResult.status, 'valid'));
check('gap source preserved', () => assert.equal(gapResult.source.rows.exercises[0].order_index, 2));
for (const mode of programming.PROGRAMMING_TRACKING_TYPES) { const rows = structuredClone(validRows); rows.exercises[0].tracking_style = mode; rows.exercises[0].weight_unit = programming.isWeightedMode(mode) ? 'plates' : 'unitless'; const actual = await result(rows); check(`mode ${mode}`, () => assert.equal(actual.status, 'valid')); }

// Exercise actual persistence with a mock HTTP adapter; no network/credentials.
function persistenceAdapter(rows, { cap = false, drift = false, empty = false, ambiguous = false, fail = false, switchAccount = false } = {}) {
  let roots = 0, sessions = 0, rpcCalls = 0; const requests = [];
  const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: switchAccount && sessions++ ? identity(999) : owner } } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from(table) { let head = false; const chain = { select(columns, options) { head = !!options?.head; requests.push({ table, columns, head }); return chain; }, eq() { return chain; }, in() { return chain; }, order() { return chain; }, maybeSingle() { return chain; },
      then(yes, no) { let response; if (table === 'routines') { roots++; const data = embeddedRows(rows); if (drift && roots === 2) data.name = 'Concurrent change'; if (cap) data.routine_days[0].planned_exercises.pop(); response = { data: empty ? null : data, count: ambiguous ? 2 : empty ? 0 : 1, error: fail ? { message: 'Synthetic failure' } : null }; }
        else response = { data: null, error: null, count: table === 'routine_days' ? rows.days.length : rows.exercises.length }; return Promise.resolve(response).then(yes, no); } }; return chain; } };
  supabase.rpc = async () => { rpcCalls++; return { error: null }; };
  const local = localTypeScriptLoader({ '@/lib/supabase': { supabase } });
  return { persistence: local('src/lib/routine-persistence.ts'), requests, rpcCalls: () => rpcCalls };
}
const transport = persistenceAdapter(legacyRows);
const transportResult = await transport.persistence.loadActiveRoutine();
check('actual loader preserves legacy result', () => assert.equal(transportResult.status, 'needs_attention'));
check('coherent reads plus exact counts', () => assert.equal(transport.requests.length, 4));
check('read requests only', () => assert(transport.requests.every(item => item.columns && !item.columns.includes('token'))));
for (const options of [{ cap: true }, { drift: true }, { ambiguous: true }, { fail: true }, { switchAccount: true }]) { const actual = await persistenceAdapter(validRows, options).persistence.loadActiveRoutine(); check('unsafe transport rejected', () => assert.equal(actual.status, 'fatal')); }
const emptyResult = await persistenceAdapter(validRows, { empty: true }).persistence.loadActiveRoutine();
check('successful empty only', () => assert.equal(emptyResult.status, 'empty'));
const wrongSubject = persistenceAdapter(validRows);
await rejectAsync('write subject mismatch rejected before RPC', () => wrongSubject.persistence.saveActiveRoutine(promoted, identity(999)));
check('wrong subject no RPC', () => assert.equal(wrongSubject.rpcCalls(), 0));
await rejectAsync('read DTO rejected at actual save boundary', () => wrongSubject.persistence.saveActiveRoutine(legacy.routine, owner));
check('raw graph no RPC', () => assert.equal(wrongSubject.rpcCalls(), 0));

function makeStore(loaded, save = async routine => model.prepareRoutinePlanForSave(routine)) {
  let listener, writes = 0, fetcher = async () => loaded;
  const local = localTypeScriptLoader({ 'zustand/middleware': { persist: initializer => initializer }, '@/lib/routine-persistence': {
    observeRoutineSubject: callback => { listener = callback; return () => {}; }, loadActiveRoutine: (...args) => fetcher(...args),
    saveActiveRoutine: routine => { writes++; return save(routine); },
  } });
  const store = local('src/store/useRoutineStore.ts').useRoutineStore;
  return { store, get: store.getState, subject: value => listener(value), setLoad: value => { fetcher = value; }, writes: () => writes };
}
const state = makeStore(legacy); await state.get().fetchRoutine();
check('store reaches needs_attention (no remember throw)', () => assert.equal(state.get().loadStatus, 'needs_attention'));
check('exclusive preserved read draft', () => assert(state.get().readGraph && !state.get().routine));
check('opening not dirty/no synthetic buffers', () => assert.deepEqual([state.get().isDirty, state.get().hasUnsavedChanges, state.get().editorBuffers], [false, false, {}]));
check('capabilities unresolved', () => { const c = compatibility.routineCapabilities(state.get()); assert.deepEqual([c.canViewRoutine, c.canEditRecoveryFields, c.canSave, c.canStartWorkout, c.canAddExercise, c.canBackup, c.canApplyTemplate, c.canReset], [true, true, false, false, false, true, false, false]); });
await rejectAsync('unresolved Save strict', () => state.get().saveRoutineToDb());
state.get().setRecoveryTrackingConfig(badIds[0], { trackingType: 'reps_weight', weightUnit: 'kg' });
check('one correction dirty and second issue remains', () => assert.deepEqual([state.get().isDirty, state.get().compatibilityIssues.length], [true, 1]));
state.get().revertRecoveryOccurrence(badIds[0]);
check('exact revert restores clean/issues', () => assert.deepEqual([state.get().isDirty, state.get().compatibilityIssues.length], [false, 2]));
state.get().setRecoveryTrackingConfig(badIds[0], { trackingType: 'reps_weight', weightUnit: 'kg' }); state.get().discardDraft();
check('Discard exact raw baseline', () => assert.deepEqual(state.get().readGraph, legacy.routine));
state.get().setRecoveryTrackingConfig(badIds[0], { trackingType: 'reps_weight', weightUnit: 'lbs' }); state.get().setRecoveryTrackingConfig(badIds[1], { trackingType: 'reps_weight', weightUnit: 'plates' });
check('resolved Save eligible but workout waits', () => assert.deepEqual([compatibility.routineCapabilities(state.get()).canSave, compatibility.routineCapabilities(state.get()).canStartWorkout], [true, false]));
state.store.setState({ editorBuffers: { synthetic: { error: 'Uncommitted recovery field' } } });
check('recovery buffers block capability', () => assert.equal(compatibility.routineCapabilities(state.get()).canSave, false));
await rejectAsync('recovery buffers cannot be skipped by Save', () => state.get().saveRoutineToDb());
check('buffer gate made no RPC', () => assert.equal(state.writes(), 0));
state.store.setState({ editorBuffers: {} });
await state.get().saveRoutineToDb();
check('success joins normal valid lane', () => assert.deepEqual([state.get().loadStatus, state.get().readGraph, state.get().isDirty, state.writes()], ['ready', null, false, 1]));
check('saved current routine strictly valid', () => assert.deepEqual(model.validateRoutinePlan(state.get().routine), []));
const failure = makeStore(legacy, async () => { throw new Error('Synthetic Save failure'); }); await failure.get().fetchRoutine();
for (const id of badIds) failure.get().setRecoveryTrackingConfig(id, { trackingType: 'reps_weight', weightUnit: 'kg' });
await rejectAsync('failed recovery remains draft', () => failure.get().saveRoutineToDb());
check('failure retains source/baseline and corrections', () => assert(failure.get().readGraph && failure.get().sourceSnapshot && failure.get().isDirty && failure.get().compatibilityIssues.length === 0));
const paused = {}; paused.promise = new Promise(resolve => { paused.resolve = resolve; });
const stale = makeStore(legacy); stale.subject(owner); stale.setLoad(() => paused.promise);
const oldFlight = stale.get().fetchRoutine(); await Promise.resolve(); stale.subject(identity(999)); stale.setLoad(async () => ({ status: 'empty' })); await stale.get().fetchRoutine(); paused.resolve(legacy); await oldFlight;
check('old subject response cannot overwrite new default', () => assert(stale.get().loadStatus === 'ready' && stale.get().readGraph === null && stale.get().sourceSnapshot === null));
const errorState = makeStore({ status: 'fatal', source: null, error: { kind: 'graph', code: 'weekday_graph', message: 'Synthetic corrupt graph' } }); await errorState.get().fetchRoutine();
check('fatal not empty/default', () => assert.deepEqual([errorState.get().loadStatus, errorState.get().routine, errorState.get().initialDefaultDraft], ['error', null, null]));

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const resolvePairs = state => badIds.forEach(id => state.get().setRecoveryTrackingConfig(id, { trackingType: 'reps_weight', weightUnit: 'kg' }));
const gatedSave = deferred(), concurrent = makeStore(legacy, () => gatedSave.promise);
await concurrent.get().fetchRoutine(); resolvePairs(concurrent);
let reentry;
const unsubscribe = concurrent.store.subscribe(next => { if (next.isSaving) reentry = next.saveRoutineToDb(); });
const saveOne = concurrent.get().saveRoutineToDb(), saveTwo = concurrent.get().saveRoutineToDb();
check('recovery single-flight duplicate and subscriber reentry', () => { assert.strictEqual(saveOne, saveTwo); assert.strictEqual(saveOne, reentry); assert.equal(concurrent.writes(), 1); });
rejects('recovery correction blocked during save', () => concurrent.get().setRecoveryTrackingConfig(badIds[0], { trackingType: 'reps_weight', weightUnit: 'lbs' }));
rejects('recovery discard blocked during save', () => concurrent.get().discardDraft());
gatedSave.resolve(compatibility.promoteRoutineForWrite(concurrent.get().readGraph)); await saveOne; unsubscribe();
check('saved source evidence invalidated', () => assert.equal(concurrent.get().sourceSnapshot, null));
let attempts = 0;
const retry = makeStore(legacy, async routine => { if (++attempts === 1) throw new Error('Synthetic first attempt'); return routine; });
await retry.get().fetchRoutine(); resolvePairs(retry);
await rejectAsync('recovery first save fails', () => retry.get().saveRoutineToDb());
await retry.get().saveRoutineToDb();
check('retry strict save succeeds without dropping corrections', () => assert.deepEqual([retry.writes(), retry.get().loadStatus, retry.get().isDirty], [2, 'ready', false]));
const accountSave = deferred(), account = makeStore(legacy, () => accountSave.promise);
await account.get().fetchRoutine(); resolvePairs(account);
const submitted = compatibility.promoteRoutineForWrite(account.get().readGraph);
const saving = account.get().saveRoutineToDb();
account.subject(identity(999));
accountSave.resolve(submitted);
await rejectAsync('late save subject switch rejected', () => saving);
check('late save cannot install other-owner draft', () => assert.deepEqual([account.get().routine, account.get().readGraph, account.get().sourceSnapshot, account.get().loadStatus], [null, null, null, 'idle']));
const reload = deferred(), race = makeStore(legacy);
await race.get().fetchRoutine(); race.setLoad(() => reload.promise);
const loading = race.get().fetchRoutine(); await Promise.resolve();
race.get().setRecoveryTrackingConfig(badIds[0], { trackingType: 'reps_weight', weightUnit: 'kg' });
reload.resolve(legacy); await loading;
check('late reload preserves newer recovery correction', () => assert.deepEqual([race.get().loadStatus, race.get().isDirty, race.get().compatibilityIssues.length], ['needs_attention', true, 1]));
const aliasState = makeStore(alias); await aliasState.get().fetchRoutine();
check('normalizations retained separately and not dirty', () => assert(aliasState.get().normalizations.length === 2 && !aliasState.get().isDirty));
const canonicalGraph = compatibility.decodeRoutineRowsForRead(rowsFromRoutine(intermediate), context);
canonicalGraph.days[0].exercises[0].fields.exerciseId = 'vx_ex_bodyweight_squat';
canonicalGraph.days[0].exercises[0].fields.trackingType = 'reps_only';
canonicalGraph.days[0].exercises[0].fields.weightUnit = 'unitless';
const canonicalId = canonicalGraph.days[0].exercises[0].id;
const canonicalOptions = compatibility.recoveryProgrammingOptions(canonicalGraph, canonicalId, canonicalGraph.days[0].exercises[0].fields.trackingType);
check('canonical recovery respects existing bounded domain', () => assert(!canonicalOptions.trackingTypes.includes('time_weight')));
rejects('canonical recovery cannot broaden capabilities', () => compatibility.correctRecoveryTracking(canonicalGraph, canonicalId, { trackingType: 'time_weight', weightUnit: 'plates' }));

// Deliberately memorialize the backend gap until separately reviewed D2E-D.
const migration = readFileSync('supabase/migrations/20260930222114_add_cardio_zone_to_planned_exercises.sql', 'utf8');
check('backend gap recorded: enums only, no pair closure yet', () => assert(/v_weight_unit not in \('kg', 'lbs', 'plates', 'unitless'\)/.test(migration) && !/v_tracking_type\s+in\s*\('reps_weight',\s*'time_weight'\)/.test(migration)));
console.log(`Routine compatibility validation passed: ${positive} positive assertions, ${negative} negative fixtures.`);
console.log('Actual decoder/normalizer/analyzer/promotion, owner-scoped read adapter, Zustand recovery and capabilities. No network, DB, Production or storage writes.');
