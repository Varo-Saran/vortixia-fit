import assert from 'node:assert/strict';
import { localTypeScriptLoader } from './lib/load-local-typescript.mjs';

let positive = 0, negative = 0;
const check = (label, test) => { try { test(); positive++; } catch (error) { error.message = `${label}: ${error.message}`; throw error; } };
const rejects = (label, test) => { assert.throws(test, undefined, label); negative++; };
const rejectsAsync = async (label, test) => { await assert.rejects(test, undefined, label); negative++; };
const loader = localTypeScriptLoader();
const editor = loader('src/lib/routine-editor.ts');
const model = loader('src/lib/routine-model.ts');
const templates = loader('src/data/built-in-routine-templates.ts').BUILT_IN_ROUTINE_TEMPLATES;
const materializer = loader('src/lib/routine-templates.ts');
const catalog = loader('src/lib/exercise-catalog.ts');
const seed = materializer.materializeRoutineTemplate(templates[2]);
// Synthetic five-mode graph and independent occurrences of the same catalog ID.
model.TRACKING_TYPES.forEach((mode, index) => {
  seed.days[0].exercises[index].trackingType = mode;
  seed.days[0].exercises[index].weightUnit = mode === 'time_weight' || mode === 'reps_weight' ? 'lbs' : 'unitless';
});
seed.days[0].exercises[4].exerciseId = seed.days[0].exercises[3].exerciseId;
const input = editor.immutableRoutine(seed);
const fingerprint = editor.routineFingerprint(input);
const ids = value => [value.id, ...value.days.flatMap(day => [day.id, ...day.exercises.map(exercise => exercise.id)])].sort();
const programming = value => Object.fromEntries(value.days.flatMap(day => day.exercises.map(exercise => [exercise.id, { ...exercise, order: undefined }])));
const day = input.days[0], first = day.exercises[0], main = day.exercises.find(exercise => exercise.section === 'main');

for (const [label, operation] of [
  ['rename routine', () => editor.renameRoutine(input, ' Chest + Back ')],
  ['rename day', () => editor.renameDay(input, day.id, ' Back & Biceps ')],
  ['kind recovery', () => editor.setDayKind(input, day.id, 'recovery')],
  ['sets', () => editor.setOccurrenceSets(input, first.id, 7)],
  ['target', () => editor.setOccurrenceTarget(input, first.id, ' 30 seconds each side ')],
  ['rest 75', () => editor.setOccurrenceRest(input, first.id, 75)],
  ['move down', () => editor.moveOccurrence(input, day.id, first.id, 'down')],
]) {
  const next = operation();
  check(`${label} every ID stable`, () => assert.deepEqual(ids(next), ids(input)));
  check(`${label} frozen input unchanged`, () => assert.equal(editor.routineFingerprint(input), fingerprint));
  check(`${label} validates`, () => model.assertValidRoutinePlan(next));
  const notes = value => Object.fromEntries(value.days.flatMap(d => d.exercises.map(e => [e.id, e.note])));
  check(`${label} preserves notes on each identity`, () => assert.deepEqual(notes(next), notes(input)));
}
for (const name of ['Tri + Bi', 'Upper / Lower', 'Push A']) check(name, () => assert.equal(editor.renameRoutine(input, name).name, name));
const renamedDay = editor.renameDay(input, day.id, ' Chest + Triceps ');
check('title trimmed', () => assert.equal(renamedDay.days[0].title, 'Chest + Triceps'));
check('title preserves kind/weekday', () => assert.deepEqual([renamedDay.days[0].weekday, renamedDay.days[0].kind], [day.weekday, day.kind]));
const recovery = editor.setDayKind(input, day.id, 'recovery');
check('training recovery retains all occurrences', () => assert.deepEqual(recovery.days[0].exercises, day.exercises));
check('training recovery retains title', () => assert.equal(recovery.days[0].title, day.title));
check('recovery training roundtrip', () => assert.deepEqual(editor.setDayKind(recovery, day.id, 'training'), input));
const empty = input.days[6];
check('empty rest accepted', () => assert.equal(editor.setDayKind(editor.setDayKind(input, empty.id, 'recovery'), empty.id, 'rest').days[6].kind, 'rest'));
check('empty recovery not startable', () => assert.equal(model.isDayStartable(editor.setDayKind(input, empty.id, 'recovery').days[6]), false));
for (const target of ['6–8', '10–12', '30 mins', '30 seconds each side', '10 each side', '10 each shape']) {
  const next = editor.setOccurrenceTarget(input, first.id, target);
  check(`target string ${target}`, () => assert.equal(model.routinePlanToRpcPayload(next).days[0].exercises[0].target_value, target));
}
for (const rest of [null, 1, 30, 45, 60, 75, 90, 120, 180, 3600]) {
  const next = editor.setOccurrenceRest(input, first.id, rest);
  check(`rest ${rest}`, () => assert.equal(model.routinePlanToRpcPayload(next).days[0].exercises[0].rest_seconds, rest));
}
check('rest buffer default is explicit null', () => assert.equal(editor.applyEditorField(input, { kind: 'rest', occurrenceId: first.id }, 'default').days[0].exercises[0].restSeconds, null));
check('custom rest buffer 75 preserved', () => assert.equal(editor.applyEditorField(input, { kind: 'rest', occurrenceId: first.id }, '75').days[0].exercises[0].restSeconds, 75));
rejects('blank custom rest is not Default', () => editor.applyEditorField(input, { kind: 'rest', occurrenceId: first.id }, ''));
const moved = editor.moveOccurrence(input, day.id, first.id, 'down');
check('move programming attached', () => assert.deepEqual(programming(moved), programming(input)));
check('move sections preserved', () => assert.deepEqual(moved.days[0].exercises.map(e => e.section), day.exercises.map(e => e.section)));
check('whole-day contiguous', () => assert.deepEqual(moved.days[0].exercises.map(e => e.order), day.exercises.map((_, i) => i)));
check('move up reverses move down', () => assert.deepEqual(editor.moveOccurrence(moved, day.id, first.id, 'up'), input));
check('warmup boundary no-op', () => assert.strictEqual(editor.moveOccurrence(input, day.id, first.id, 'up'), input));
check('main section boundary no-op', () => assert.strictEqual(editor.moveOccurrence(input, day.id, main.id, 'up'), input));
const interleaved = editor.cloneRoutine(input);
interleaved.days[0].exercises[1].section = 'main';
check('interleaved ordering load/projection untouched', () => {
  const before = JSON.stringify(interleaved); editor.routineFingerprint(interleaved); assert.equal(JSON.stringify(interleaved), before);
});
check('interleaved nearest same-section swap', () => assert.equal(editor.moveOccurrence(interleaved, day.id, first.id, 'down').days[0].exercises[2].id, first.id));
const addInput = { exerciseId: 'vx_ex_bodyweight_squat', name: 'untrusted legacy display', targetMuscle: 'untrusted', section: 'warmup', targetSets: 2, targetValue: '10', trackingType: 'reps_only', weightUnit: 'unitless', restSeconds: null };
const added = editor.addOccurrence(input, day.id, addInput);
const fresh = added.days[0].exercises.find(e => !day.exercises.some(old => old.id === e.id));
check('add exactly one new UUID', () => assert.equal(ids(added).filter(id => !ids(input).includes(id)).length, 1));
check('add canonical snapshot', () => assert.deepEqual([fresh.name, fresh.targetMuscle], [catalog.getExerciseById(addInput.exerciseId).displayName, catalog.getExerciseById(addInput.exerciseId).primaryMuscle]));
check('add warmup position', () => assert.equal(added.days[0].exercises.findIndex(e => e.id === fresh.id), day.exercises.filter(e => e.section === 'warmup').length));
check('add reindexed', () => assert.deepEqual(added.days[0].exercises.map(e => e.order), added.days[0].exercises.map((_, i) => i)));
check('remove newly added roundtrip', () => assert.deepEqual(editor.removeOccurrence(added, fresh.id), input));
const addedMain = editor.addOccurrence(input, day.id, { ...addInput, section: 'main' });
check('main appended', () => assert.equal(addedMain.days[0].exercises.at(-1).exerciseId, addInput.exerciseId));
const removed = editor.removeOccurrence(input, day.exercises[3].id);
check('remove exactly one UUID', () => assert.deepEqual(ids(input).filter(id => !ids(removed).includes(id)), [day.exercises[3].id]));
check('duplicate catalog occurrence independent', () => assert(removed.days[0].exercises.some(e => e.id === day.exercises[4].id)));
check('all five modes survive ordinary edits', () => assert.deepEqual(editor.setOccurrenceRest(input, first.id, 75).days[0].exercises.slice(0, 5).map(e => e.trackingType), model.TRACKING_TYPES));
check('recovery preserved', () => assert.deepEqual(moved.days[5], input.days[5]));
check('fingerprint includes IDs', () => { const next = editor.cloneRoutine(input); next.days[0].exercises[0].id = model.createRoutineUuid(); assert.notEqual(editor.routineFingerprint(next), fingerprint); });
check('projection sorts without changing source', () => { const next = editor.cloneRoutine(input); next.days.reverse(); next.days[6].exercises.reverse(); assert.equal(editor.routineFingerprint(next), fingerprint); });
check('projection does not repair malformed order', () => { const next = editor.cloneRoutine(input); next.days[0].exercises[0].order = 999; assert.equal(editor.persistedRoutineProjection(next).days[0].exercises.at(-1).order, 999); });
check('absence note consistent', () => { const next = editor.cloneRoutine(input); delete next.days[0].exercises[0].note; const second = editor.cloneRoutine(next); second.days[0].exercises[0].note = undefined; assert.equal(editor.routineFingerprint(next), editor.routineFingerprint(second)); });
for (const [scope, fields] of [
  ['routine', ['id', 'name']], ['day', ['id', 'weekday', 'title', 'kind']],
  ['occurrence', ['id', 'exerciseId', 'name', 'targetMuscle', 'section', 'order', 'targetSets', 'targetValue', 'trackingType', 'weightUnit', 'restSeconds', 'note']],
]) for (const field of fields) {
  const changed = editor.cloneRoutine(input);
  const subject = scope === 'routine' ? changed : scope === 'day' ? changed.days[0] : changed.days[0].exercises[0];
  subject[field] = typeof subject[field] === 'number' ? subject[field] + 1 : `${subject[field]}-changed`;
  check(`projection includes ${scope}.${field}`, () => assert.notEqual(editor.routineFingerprint(changed), fingerprint));
}
const roundtripDraft = editor.setOccurrenceRest(editor.setOccurrenceTarget(moved, first.id, '30 seconds each side'), first.id, 75);
const payload = model.routinePlanToRpcPayload(roundtripDraft);
const reloaded = model.routinePlanFromRows({ routine: { id: payload.id, name: payload.name },
  days: payload.days.map(d => ({ id: d.id, routine_id: payload.id, day_name: model.weekdayLabel(d.weekday), type: d.kind, title: d.title })),
  exercises: payload.days.flatMap(d => d.exercises.map(e => ({ id: e.id, routine_day_id: d.id, exercise_id: e.exercise_id, name: e.name,
    type: e.target_muscle, tracking_style: e.tracking_type, weight_unit: e.weight_unit, target_sets: e.target_sets,
    target_reps: e.target_value, rest_seconds: e.rest_seconds, note: e.note, is_warmup: e.section === 'warmup', order_index: e.order }))),
});
check('editor operations D1 serialization/row reload lossless', () => assert.equal(editor.routineFingerprint(reloaded), editor.routineFingerprint(roundtripDraft)));
for (const name of ['', ' ', 'x'.repeat(81)]) rejects('invalid name', () => editor.renameRoutine(input, name));
for (const title of ['', ' ', 'x'.repeat(61)]) rejects('invalid title', () => editor.renameDay(input, day.id, title));
rejects('invalid kind', () => editor.setDayKind(input, day.id, 'other'));
rejects('populated rest', () => editor.setDayKind(input, day.id, 'rest'));
for (const sets of [0, -1, 101, 1.5, NaN]) rejects('invalid sets', () => editor.setOccurrenceSets(input, first.id, sets));
for (const target of ['', ' ', 'x'.repeat(81)]) rejects('invalid target', () => editor.setOccurrenceTarget(input, first.id, target));
for (const rest of [0, -1, 3601, 1.5, NaN]) rejects('invalid rest', () => editor.setOccurrenceRest(input, first.id, rest));
for (const operation of [() => editor.renameDay(input, 'unknown', 'Valid'), () => editor.setOccurrenceSets(input, 'unknown', 3), () => editor.removeOccurrence(input, 'unknown'), () => editor.moveOccurrence(input, day.id, 'unknown', 'up'), () => editor.moveOccurrence(input, day.id, first.id, 'sideways')]) rejects('unknown identity/direction', operation);
rejects('reorder incomplete', () => editor.reorderDay(input, day.id, []));
rejects('reorder duplicated', () => editor.reorderDay(input, day.id, day.exercises.map(() => first.id)));
rejects('reorder section crossing', () => editor.reorderDay(input, day.id, day.exercises.map(e => e.id).reverse()));
rejects('reorder unknown', () => editor.reorderDay(input, day.id, day.exercises.map((e, i) => i ? e.id : 'unknown')));
rejects('add Rest', () => editor.addOccurrence(input, empty.id, addInput));
for (const exerciseId of [null, 'not_in_catalog', catalog.getExerciseCatalog().find(e => e.discoveryTier === 'hidden').id]) rejects('unresolved/prohibited Add', () => editor.addOccurrence(input, day.id, { ...addInput, exerciseId }));
for (const change of [{ targetSets: 0 }, { targetValue: '' }, { restSeconds: 0 }, { section: 'invalid' }, { trackingType: 'reps_weight' }, { weightUnit: 'kg' }, { weightUnit: 'lb' }]) rejects('invalid Add programming', () => editor.addOccurrence(input, day.id, { ...addInput, ...change }));

function makeStore({ loaded = seed, save = async routine => model.prepareRoutinePlanForSave(routine), confirm = async () => true, load } = {}) {
  let options, writes = 0, loads = 0;
  const submissions = [];
  const local = localTypeScriptLoader({
    '@/lib/routine-persistence': { loadActiveRoutine: async () => { loads++; return load ? load() : loaded && structuredClone(loaded); }, saveActiveRoutine: async routine => { writes++; submissions.push(structuredClone(routine)); return save(routine); } },
    'zustand/middleware': { persist: (initializer, opts) => { options = opts; return initializer; } },
  });
  const guard = local('src/lib/routine-draft-guard.ts');
  guard.registerRoutineGuard(confirm);
  const store = local('src/store/useRoutineStore.ts').useRoutineStore;
  return { store, get: store.getState, options, submissions, writes: () => writes, loads: () => loads, guard };
}
const saved = makeStore(); await saved.get().fetchRoutine();
check('successful load Saved', () => assert.equal(saved.get().draftStatus, 'Saved'));
check('no automatic save', () => assert.equal(saved.writes(), 0));
check('baseline detached', () => assert.notStrictEqual(saved.get().routine.days[0].exercises[0], saved.get().savedBaseline.days[0].exercises[0]));
rejects('baseline frozen', () => { saved.get().savedBaseline.days[0].exercises[0].targetSets = 99; });
saved.get().setRoutineName('Edited');
check('domain edit unsaved', () => assert.equal(saved.get().draftStatus, 'Unsaved changes'));
saved.get().setRoutineName(seed.name);
check('exact revert Saved', () => assert.equal(saved.get().draftStatus, 'Saved'));
const revision = saved.get().draftRevision;
const fakeReplacement = editor.cloneRoutine(seed); fakeReplacement.days[0].exercises[0].exerciseId = 'other';
rejects('bulk setter cannot bypass exercise identity lock', () => saved.get().setRoutine(fakeReplacement));
rejects('existing occurrence logging remains locked', () => saved.get().updateOccurrence(first.id, { trackingType: 'time_only' }));
saved.get().setRoutineName(seed.name);
saved.get().moveOccurrence(day.id, first.id, 'up');
check('no-op revision stable', () => assert.equal(saved.get().draftRevision, revision));
const nameField = { kind: 'routine-name' };
saved.get().setEditorBuffer(nameField, 'Buffered name');
check('buffer unsaved', () => assert.equal(saved.get().hasUnsavedChanges, true));
const bufferRevision = saved.get().draftRevision;
saved.get().setEditorBuffer(nameField, 'Buffered name');
check('same raw no revision churn', () => assert.equal(saved.get().draftRevision, bufferRevision));
const remounted = saved.store.getState();
check('buffer survives lifecycle (same shared store)', () => assert.equal(remounted.editorBuffers['routine-name'].raw, 'Buffered name'));
saved.get().setEditorBuffer(nameField, seed.name);
check('buffer revert Saved', () => assert.equal(saved.get().draftStatus, 'Saved'));
saved.get().setEditorBuffer({ kind: 'sets', occurrenceId: first.id }, '');
await rejectsAsync('invalid buffer blocks Save', () => saved.get().saveRoutineToDb());
check('invalid buffer retained', () => assert.equal(saved.get().editorBuffers[`sets:${first.id}`].raw, ''));
check('invalid save no write', () => assert.equal(saved.writes(), 0));
saved.get().discardDraft();
check('discard restores saved graph', () => assert.deepEqual(saved.get().routine, seed));
check('discard clears buffers', () => assert.deepEqual(saved.get().editorBuffers, {}));
check('discard no DB write', () => assert.equal(saved.writes(), 0));
const pendingAdd = { dayId: day.id, section: 'main', exerciseId: 'vx_ex_bodyweight_squat', rawSets: '2', rawTarget: '10', trackingType: 'reps_only', weightUnit: 'unitless', restSeconds: null };
saved.get().setPendingAdd(pendingAdd);
check('pending Add unsaved', () => assert.equal(saved.get().hasUnsavedChanges, true));
check('pending Add no UUID', () => assert.equal(Object.hasOwn(saved.get().pendingAdd, 'id'), false));
await rejectsAsync('pending Add blocks Save', () => saved.get().saveRoutineToDb());
saved.get().commitPendingAdd();
check('committed Add one fresh identity', () => assert.equal(ids(saved.get().routine).length, ids(seed).length + 1));
check('pending Add cleared only on commit', () => assert.equal(saved.get().pendingAdd, null));
saved.get().discardDraft();
const unchanged = await saved.get().saveRoutineToDb();
check('unchanged outcome', () => assert.equal(unchanged.status, 'unchanged'));
check('unchanged no write', () => assert.equal(saved.writes(), 0));
saved.get().setEditorBuffer(nameField, 'Submitted buffer');
const savedBuffer = await saved.get().saveRoutineToDb();
check('eligible buffer submitted', () => assert.equal(saved.submissions.at(-1).name, 'Submitted buffer'));
check('submitted buffer cleared', () => assert.deepEqual(saved.get().editorBuffers, {}));
check('success Saved', () => assert.equal(savedBuffer.status, 'saved'));
check('transient not in submission', () => assert.deepEqual(Object.keys(saved.submissions.at(-1)), ['id', 'name', 'days']));
check('transient not in storage', () => assert.deepEqual(Object.keys(saved.options.partialize(saved.get())), ['customTemplates']));
const never = makeStore({ loaded: null }); await never.get().fetchRoutine();
const initial = editor.cloneRoutine(never.get().initialDefaultDraft);
check('never saved status', () => assert.equal(never.get().draftStatus, 'Not saved yet'));
check('never saved guard eligibility', () => assert.equal(never.get().hasUnsavedChanges, true));
check('never saved no save on view', () => assert.equal(never.writes(), 0));
never.get().setRoutineName('Temporary'); never.get().setPendingAdd({ ...pendingAdd, dayId: never.get().routine.days[0].id }); never.get().discardDraft();
check('never saved discard exact initial graph/IDs', () => assert.deepEqual(never.get().routine, initial));
check('never saved discard still Not saved', () => assert.equal(never.get().draftStatus, 'Not saved yet'));
await never.get().saveRoutineToDb();
check('first save default writes', () => assert.equal(never.writes(), 1));
check('first save establishes baseline', () => assert.equal(never.get().draftStatus, 'Saved'));
check('clean beforeunload ineligible', () => assert.equal(never.get().hasUnsavedChanges, false));

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const wait = deferred();
const race = makeStore({ save: () => wait.promise }); await race.get().fetchRoutine();
race.get().setRoutineName('Submitted revision');
let joinedBySubscriber;
const unsubscribe = race.store.subscribe(state => { if (state.isSaving && !joinedBySubscriber) joinedBySubscriber = state.saveRoutineToDb(); });
const flight1 = race.get().saveRoutineToDb(), flight2 = race.get().saveRoutineToDb();
check('two saves same promise', () => assert.strictEqual(flight1, flight2));
check('subscriber reentry joins flight', () => assert.strictEqual(flight1, joinedBySubscriber));
check('exactly one underlying write', () => assert.equal(race.writes(), 1));
const submitted = race.submissions[0];
race.get().updateOccurrence(first.id, { targetSets: 9 });
rejects('discard while saving', () => race.get().discardDraft());
await rejectsAsync('replacement while saving', () => race.get().applyTemplate(templates[0].id));
check('controlled leave blocked while saving', () => assert.equal(race.get().isSaving, true));
assert.equal(await race.get().requestLeave('/routines'), false); positive++;
wait.resolve(submitted); const outcome = await flight1; await flight2; unsubscribe();
check('older save explicit newer outcome', () => assert.equal(outcome.status, 'saved-with-newer-edits'));
check('newer edit retained', () => assert.equal(race.get().routine.days[0].exercises[0].targetSets, 9));
check('baseline is submitted version', () => assert.deepEqual(race.get().savedBaseline, submitted));
check('newer edits still dirty', () => assert.equal(race.get().draftStatus, 'Unsaved changes'));
check('newer draft suppresses success navigation eligibility', () => assert.equal(outcome.status !== 'saved-with-newer-edits' && !race.get().hasUnsavedChanges, false));
check('save does not autoqueue second write', () => assert.equal(race.writes(), 1));
const rawWait = deferred();
const rawRace = makeStore({ save: () => rawWait.promise }); await rawRace.get().fetchRoutine(); rawRace.get().setRoutineName('Submitted');
const rawFlight = rawRace.get().saveRoutineToDb();
rawRace.get().setEditorBuffer({ kind: 'sets', occurrenceId: first.id }, '');
rawRace.get().setPendingAdd(pendingAdd);
rawWait.resolve(rawRace.submissions[0]); const rawOutcome = await rawFlight;
check('new raw buffer preserved', () => assert.equal(rawRace.get().editorBuffers[`sets:${first.id}`].raw, ''));
check('new buffer error preserved', () => assert(rawRace.get().editorBuffers[`sets:${first.id}`].error));
check('new pending Add preserved', () => assert.deepEqual(rawRace.get().pendingAdd, pendingAdd));
check('raw newer outcome', () => assert.equal(rawOutcome.status, 'saved-with-newer-edits'));
check('raw newer still dirty', () => assert.equal(rawRace.get().hasUnsavedChanges, true));
const failureWithPending = deferred();
const pendingFailure = makeStore({ save: () => failureWithPending.promise }); await pendingFailure.get().fetchRoutine(); pendingFailure.get().setRoutineName('Pending failure');
const pendingFailureFlight = pendingFailure.get().saveRoutineToDb(); const pendingFailureAssertion = rejectsAsync('failure with newer pending input', () => pendingFailureFlight);
pendingFailure.get().setPendingAdd(pendingAdd); failureWithPending.reject(new Error('Synthetic pending failure')); await pendingFailureAssertion;
check('failure preserves newer pending Add', () => assert.deepEqual(pendingFailure.get().pendingAdd, pendingAdd));
const sameFieldWait = deferred();
let delaySameField = true;
const sameField = makeStore({ save: routine => delaySameField ? sameFieldWait.promise : Promise.resolve(routine) });
await sameField.get().fetchRoutine();
sameField.get().setEditorBuffer(nameField, 'Submitted raw name');
const sameFieldFlight = sameField.get().saveRoutineToDb();
sameField.get().setRoutineName('Newest domain name');
sameFieldWait.resolve(sameField.submissions[0]); await sameFieldFlight;
check('newer same-field domain edit survives submitted buffer', () => assert.equal(sameField.get().routine.name, 'Newest domain name'));
delaySameField = false; await sameField.get().saveRoutineToDb();
check('later save cannot replay an older committed raw buffer', () => assert.equal(sameField.submissions.at(-1).name, 'Newest domain name'));
const failedWait = deferred(); let fail = true;
const failed = makeStore({ save: routine => fail ? failedWait.promise : Promise.resolve(routine) }); await failed.get().fetchRoutine(); failed.get().setRoutineName('Failure draft');
failed.get().setEditorBuffer({ kind: 'target', occurrenceId: first.id }, '10 each shape');
const failing = failed.get().saveRoutineToDb(); const failureAssertion = rejectsAsync('save IO failure', () => failing);
failed.get().updateOccurrence(first.id, { restSeconds: 75 }); failedWait.reject(new Error('Synthetic save error')); await failureAssertion;
check('failure newer draft preserved', () => assert.equal(failed.get().routine.days[0].exercises[0].restSeconds, 75));
check('failure buffers preserved', () => assert.equal(failed.get().editorBuffers[`target:${first.id}`].raw, '10 each shape'));
check('failure baseline unchanged', () => assert.deepEqual(failed.get().savedBaseline, seed));
check('failure error visible', () => assert.equal(failed.get().error, 'Synthetic save error'));
check('failure loading cleared', () => assert.equal(failed.get().isSaving, false));
check('failure submittedRevision cleared', () => assert.equal(failed.get().submittedRevision, null));
fail = false; await failed.get().saveRoutineToDb();
check('retry current draft saved', () => assert.equal(failed.get().savedBaseline.days[0].exercises[0].restSeconds, 75));
check('retry successful', () => assert.equal(failed.get().draftStatus, 'Saved'));

let confirmed = false, prompts = 0;
const guarded = makeStore({ confirm: async () => { prompts++; return confirmed; } }); await guarded.get().fetchRoutine();
guarded.get().setRoutineName('Dirty guard'); const dirtyBefore = editor.draftGuardFingerprint(guarded.get());
assert.equal(await guarded.get().requestReplacement('Template'), null); positive++;
await rejectsAsync('cancelled Apply', () => guarded.get().applyTemplate(templates[0].id));
check('cancel no mutation', () => assert.equal(editor.draftGuardFingerprint(guarded.get()), dirtyBefore));
check('cancel no write', () => assert.equal(guarded.writes(), 0));
assert.equal(await guarded.get().requestLeave('/routines'), false); positive++;
check('cancelled leave preserves graph', () => assert.equal(editor.draftGuardFingerprint(guarded.get()), dirtyBefore));
confirmed = true;
const approval = await guarded.get().requestReplacement('Template'); guarded.get().setRoutineName('Newer approval revision');
await rejectsAsync('stale replacement approval', () => guarded.get().replaceAndSaveRoutine(templates[0], undefined, approval));
check('stale approval no replacement', () => assert.equal(guarded.get().routine.name, 'Newer approval revision'));
await rejectsAsync('unissued approval cannot bypass', () => guarded.get().replaceAndSaveRoutine(templates[0], undefined, { revision: guarded.get().draftRevision, fingerprint: editor.draftGuardFingerprint(guarded.get()) }));
const invalidSource = structuredClone(templates[0]); invalidSource.days[0].occurrences[0].exercise.defaultExerciseId = 'missing';
const previousPrompts = prompts;
await rejectsAsync('invalid replacement rejected before discard prompt', () => guarded.get().replaceAndSaveRoutine(invalidSource));
check('invalid source no prompt', () => assert.equal(prompts, previousPrompts));
check('invalid source preserves dirty graph', () => assert.equal(guarded.get().routine.name, 'Newer approval revision'));
await guarded.get().applyTemplate(templates[0].id);
check('approved replace root reused', () => assert.equal(guarded.get().routine.id, seed.id));
check('approved replace exact count', () => assert.equal(guarded.get().routine.days.flatMap(d => d.exercises).length, 17));
check('approved replacement Saved', () => assert.equal(guarded.get().draftStatus, 'Saved'));
guarded.get().setRoutineName('Leave edits');
assert.equal(await guarded.get().requestLeave('/routines'), true); positive++;
check('confirmed leave restores baseline', () => assert.deepEqual(guarded.get().routine, guarded.get().savedBaseline));
check('confirmed leave does not save', () => assert.equal(guarded.writes(), 1));
const promptWait = deferred();
const changingPrompt = makeStore({ confirm: () => promptWait.promise }); await changingPrompt.get().fetchRoutine(); changingPrompt.get().setRoutineName('First');
const pendingLeave = changingPrompt.get().requestLeave('/routines'); changingPrompt.get().setRoutineName('Changed during dialog'); promptWait.resolve(true);
assert.equal(await pendingLeave, false); positive++;
check('stale leave preserves newer draft', () => assert.equal(changingPrompt.get().routine.name, 'Changed during dialog'));
const unmounted = makeStore(); await unmounted.get().fetchRoutine(); unmounted.get().setRoutineName('Dirty');
const unregister = unmounted.guard.registerRoutineGuard(async () => true); unregister();
await rejectsAsync('absent guard fails closed', () => unmounted.get().applyTemplate(templates[0].id));
const unavailable = makeStore({ load: async () => { throw new Error('Synthetic load failure'); } });
const log = console.error; console.error = () => {};
try { await unavailable.get().fetchRoutine(); } finally { console.error = log; }
await rejectsAsync('unsafe load Save rejected', () => unavailable.get().saveRoutineToDb());
rejects('unsafe load cannot install fake verified graph', () => unavailable.get().setRoutine(seed));
check('unsafe load no default', () => assert.equal(unavailable.get().routine, null));
check('unsafe load no write', () => assert.equal(unavailable.writes(), 0));
// Actual workout store, only external IO/effects stubbed. No completion invoked.
const inert = { getState: () => ({}) };
const workoutLoader = localTypeScriptLoader({
  'zustand/middleware': { persist: initializer => initializer },
  './useTrophyStore': { useTrophyStore: inert }, './useRecoveryStore': { useRecoveryStore: inert },
  './useSocialStore': { useSocialStore: inert }, './useProfileStore': { useProfileStore: inert },
  './useSettingsStore': { useSettingsStore: { getState: () => ({ defaultRestTimer: 90 }) } },
  '@/lib/workout-completion-client': { createWorkoutOperationId: () => 'synthetic-operation' },
});
const workout = workoutLoader('src/store/useWorkoutStore.ts').useWorkoutStore;
workout.getState().startWorkout('Synthetic session only', seed.days[0].exercises);
const snapshot = structuredClone(workout.getState().exercises);
saved.get().updateOccurrence(first.id, { restSeconds: 75 });
check('routine rest leaves actual active workout snapshot untouched', () => assert.deepEqual(workout.getState().exercises, snapshot));
workout.getState().setExerciseRestSeconds(first.id, 120);
check('active session rest leaves routine unchanged', () => assert.equal(saved.get().routine.days[0].exercises[0].restSeconds, 75));
check('source blueprints unchanged', () => materializer.validateRoutineTemplates(templates));
console.log(`Routine editor validation passed: ${positive} positive assertions, ${negative} negative fixtures.`);
console.log('Actual domain operations, Zustand actions, guard bridge, D1 serialization and active workout snapshot exercised.');
console.log('Deterministic single-flight / subscriber reentry / stale domain+buffer / failure+retry / cancellation+stale approval fixtures passed.');
console.log('No network, database, Production, or localStorage writes.');
