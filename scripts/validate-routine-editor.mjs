import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
const addInput = { exerciseId: 'vx_ex_bodyweight_squat', name: 'untrusted legacy display', targetMuscle: 'untrusted', section: 'warmup', targetSets: 2, targetValue: '10', trackingType: 'reps_only', weightUnit: 'unitless', restSeconds: null, cardioZone: null };
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
  ['occurrence', ['id', 'exerciseId', 'name', 'targetMuscle', 'section', 'order', 'targetSets', 'targetValue', 'trackingType', 'weightUnit', 'restSeconds', 'cardioZone', 'note']],
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
    target_reps: e.target_value, rest_seconds: e.rest_seconds, cardio_zone: e.cardioZone, note: e.note, is_warmup: e.section === 'warmup', order_index: e.order }))),
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
rejects('independent tracking mutation remains locked; use atomic config', () => saved.get().updateOccurrence(first.id, { trackingType: 'time_only' }));
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
const pendingAdd = { dayId: day.id, section: 'main', exerciseId: 'vx_ex_bodyweight_squat', rawSets: '2', rawTarget: '10', trackingType: 'reps_only', weightUnit: 'unitless', restSeconds: null, cardioZone: null };
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
let workoutPersistence;
const workoutLoader = localTypeScriptLoader({
  'zustand/middleware': { persist: (initializer, options) => { workoutPersistence = options; return initializer; } },
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

// D2C: actual controls, buffer -> operation adapters and rendered React markup.
// Browser QA separately exercises events/focus/responsive styling. SSR imports
// share the real store actions; only hooks/Next navigation/external IO are stubbed.
const controls = loader('src/lib/routine-editor-controls.ts');
const uiState = makeStore(); await uiState.get().fetchRoutine();
const hook = selector => selector ? selector(uiState.get()) : uiState.get();
hook.getState = uiState.get;
const SharedSelect = loader('src/components/ui/Select.tsx').Select;
const selectInvocations = [];
const lastSelect = label => selectInvocations.findLast(props => props.label === label);
const uiLoader = localTypeScriptLoader({
  '@/components/ui/Select': { Select: props => { selectInvocations.push(props); return React.createElement(SharedSelect, props); } },
  '@/store/useRoutineStore': { useRoutineStore: hook },
  '@/store/useSettingsStore': { useSettingsStore: selector => selector({ defaultRestTimer: 90 }) },
  '@/components/RoutineDraftGuard': { RoutineGuardedLink: ({ children, ...props }) => React.createElement('a', props, children) },
});
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const Page = uiLoader('src/app/routines/edit/page.tsx').default;
const DayEditor = uiLoader('src/components/routine-editor/RoutineDayEditor.tsx').RoutineDayEditor;
const OccurrenceEditor = uiLoader('src/components/routine-editor/RoutineOccurrenceEditor.tsx').RoutineOccurrenceEditor;
const RestControl = uiLoader('src/components/routine-editor/OccurrenceRestControl.tsx').RestControl;
const Drawer = uiLoader('src/components/routine-editor/AddExerciseDrawer.tsx').AddExerciseDrawer;
const Information = uiLoader('src/components/routine-editor/RoutineInformation.tsx').RoutineInformation;
const uiIds = ids(uiState.get().routine);
const commit = (field, raw) => {
  uiState.get().setEditorBuffer(field, raw);
  controls.commitEditorInput(field, raw, uiState.get(), uiState.get().routine.days);
};
for (const name of [' Chest + Back ', 'Tri + Bi', 'Upper / Lower', 'Push A']) {
  commit(nameField, name);
  check(`UI routine name commit ${name}`, () => assert.equal(uiState.get().routine.name, name.trim()));
}
commit(nameField, seed.name);
check('UI name exact revert Saved', () => assert.equal(uiState.get().draftStatus, 'Saved'));
uiState.get().setEditorBuffer(nameField, '');
check('UI blank name aria invalid', () => assert.match(render(Page), /aria-invalid="true"/));
check('UI invalid buffer Save disabled', () => assert.equal(controls.canSaveEditor(uiState.get()), false));
check('UI invalid name does not corrupt domain', () => assert.equal(uiState.get().routine.name, seed.name));
uiState.get().discardDraft();
commit({ kind: 'day-title', dayId: day.id }, ' Chest + Triceps ');
check('UI title committed trim', () => assert.equal(uiState.get().routine.days[0].title, 'Chest + Triceps'));
check('UI title stable weekday/kind', () => assert.deepEqual([uiState.get().routine.days[0].weekday, uiState.get().routine.days[0].kind], [day.weekday, day.kind]));
for (const sets of ['1', '4', '100']) { commit({ kind: 'sets', occurrenceId: first.id }, sets); check(`UI sets ${sets}`, () => assert.equal(uiState.get().routine.days[0].exercises[0].targetSets, Number(sets))); }
for (const raw of ['', '0', '101', '2.5']) {
  uiState.get().setEditorBuffer({ kind: 'sets', occurrenceId: first.id }, raw);
  check(`UI invalid raw sets ${raw} blocks Save`, () => assert.equal(controls.canSaveEditor(uiState.get()), false));
  check('UI raw sets never NaN in graph', () => assert(Number.isInteger(uiState.get().routine.days[0].exercises[0].targetSets)));
}
uiState.get().discardDraft();
for (const target of ['6–8', '30 mins', '30 seconds each side', '10 each side', '10 each shape']) {
  commit({ kind: 'target', occurrenceId: first.id }, target);
  check(`UI target text ${target}`, () => assert.equal(uiState.get().routine.days[0].exercises[0].targetValue, target));
}
uiState.get().discardDraft();
for (const rest of [null, ...controls.REST_PRESETS, 75, 1, 3600]) {
  const raw = rest === null ? 'default' : String(rest);
  commit({ kind: 'rest', occurrenceId: first.id }, raw);
  check(`UI rest commit ${raw}`, () => assert.equal(uiState.get().routine.days[0].exercises[0].restSeconds, rest));
  check(`UI rest D1 roundtrip ${raw}`, () => assert.equal(model.routinePlanToRpcPayload(uiState.get().routine).days[0].exercises[0].rest_seconds, rest));
  const markup = render(RestControl, { id: 'test-rest', raw, error: null, onChange() {}, defaultRest: 90 });
  check(`UI rest display ${raw}`, () => assert(markup.includes(`Rest: ${controls.formatRest(rest)}`)));
}
for (const raw of ['', '0', '3601', '-1', '1.5', 'NaN']) {
  rejects(`UI invalid rest parsing ${raw}`, () => controls.parseRestInput(raw));
  uiState.get().setEditorBuffer({ kind: 'rest', occurrenceId: first.id }, raw);
  check(`UI invalid rest ${raw} disables Save`, () => assert.equal(controls.canSaveEditor(uiState.get()), false));
}
uiState.get().discardDraft();
const activeSnapshotBeforeUiRest = structuredClone(workout.getState().exercises);
commit({ kind: 'rest', occurrenceId: first.id }, '75');
await uiState.get().saveRoutineToDb();
const reloadedRest = makeStore({ loaded: uiState.get().routine }); await reloadedRest.get().fetchRoutine();
check('UI rest save/reload exactly 75', () => assert.equal(reloadedRest.get().routine.days[0].exercises[0].restSeconds, 75));
check('UI rest does not change active snapshot', () => assert.deepEqual(workout.getState().exercises, activeSnapshotBeforeUiRest));
commit({ kind: 'rest', occurrenceId: first.id }, '120'); commit({ kind: 'rest', occurrenceId: first.id }, '75');
check('UI rest revert Saved', () => assert.equal(uiState.get().draftStatus, 'Saved'));
check('UI edits stable identities', () => assert.deepEqual(ids(uiState.get().routine), uiIds));
const wholePage = render(Page);
const dayProps = { day: uiState.get().routine.days[0], expanded: true, defaultRest: 90, onToggle() {}, onAdd() {}, announce() {}, focus() {} };
const settingsMarkup = render(DayEditor, { ...dayProps, settingsOpen: true, activeOccurrenceId: first.id });
const reorderMarkup = render(DayEditor, { ...dayProps, reorderSection: 'warmup' });
const editingMarkup = wholePage + settingsMarkup + render(Information, { name: seed.name, count: 64, expanded: true, onEdit() {}, onDone() {} });
check('UI all 64 occurrence cards rendered', () => assert.equal((wholePage.match(/<article /g) ?? []).length, 64));
check('UI all 11 warmups rendered', () => assert.equal((wholePage.match(/· Warm-up<\/p>/g) ?? []).length, 11));
for (const phrase of ['Routine name', 'Day title', 'Day kind', 'Warm-up', 'Main exercises', 'Recovery activities', 'Rest day — no exercises planned', 'Remove all exercises before changing this day to Rest.']) {
  check(`UI visible control ${phrase}`, () => assert(editingMarkup.includes(phrase)));
}
check('UI rest has no Add control', () => assert(!render(DayEditor, { day: uiState.get().routine.days[6], expanded: true, defaultRest: 90, onToggle() {}, onAdd() {}, announce() {}, focus() {} }).includes('id="routine-add-')));
for (const mode of model.TRACKING_TYPES) {
  const markup = render(OccurrenceEditor, { occurrence: { ...first, trackingType: mode }, expanded: true, canMoveUp: false, canMoveDown: true, defaultRest: 90, isSaving: false, onMove() {}, onRemove() {} });
  check(`UI five-mode label ${mode}`, () => assert(markup.includes(controls.TRACKING_LABELS[mode].replace('&', '&amp;'))));
  check(`UI tracking editable custom Select ${mode}`, () => assert(markup.includes('>Tracking</label>') && markup.includes('aria-haspopup="listbox"') && !markup.includes('Tracking (read-only)')));
}
for (const unit of model.WEIGHT_UNITS) check(`UI unit ${unit}`, () => {
  const markup = render(OccurrenceEditor, { occurrence: { ...first, trackingType: unit === 'unitless' ? 'reps_only' : 'reps_weight', weightUnit: unit }, expanded: true, canMoveUp: false, canMoveDown: false, defaultRest: 90, onMove() {}, onRemove() {} });
  assert(unit === 'unitless' ? !markup.includes('Load unit') : markup.includes(controls.UNIT_LABELS[unit]));
});
check('UI notes verbatim escaped markup', () => assert(render(OccurrenceEditor, { occurrence: seed.days[0].exercises.at(-1), expanded: true, defaultRest: 90, onMove() {}, onRemove() {} }).includes('Aerobic base building')));
check('UI accordion hooks', () => assert.equal((wholePage.match(/id="day-heading-[^"]+"[^>]*aria-expanded=/g) ?? []).length, 7));
check('UI region relationships', () => assert.equal((wholePage.match(/role="region"/g) ?? []).length, 7));
check('UI input labels and errors', () => assert(settingsMarkup.includes('for="editor-sets:') && settingsMarkup.includes('aria-invalid="false"')));
check('UI Move accessible names', () => assert(reorderMarkup.includes('aria-label="Move ') && reorderMarkup.includes(' down"')));
check('UI boundary Up disabled', () => assert.match(reorderMarkup, /disabled="" aria-label="Move [^"]+ up"/));
check('UI notes/IDs survive move adapter', () => {
  const before = uiState.get().routine; uiState.get().moveOccurrence(day.id, first.id, 'down');
  assert.deepEqual(programming(before), programming(uiState.get().routine)); assert.deepEqual(ids(before), ids(uiState.get().routine));
});
uiState.get().discardDraft();
const arm = catalog.getExerciseById('vx_ex_arm_swing');
const dbHip = catalog.getExerciseById('vx_ex_dumbbell_hip_thrust');
const imported = catalog.getExerciseById('0025');
for (const ex of [arm, dbHip, imported]) {
  const pending = controls.createPendingAdd(ex, day.id);
  check(`UI Add no identity until commit ${ex.id}`, () => assert(!Object.hasOwn(pending, 'id')));
  check(`UI Add resets target/rest ${ex.id}`, () => assert.deepEqual([pending.rawSets, pending.rawTarget, pending.restSeconds, pending.rawRest], ['3', '', null, 'default']));
}
check('UI imported missing capability needs explicit choice', () => assert.equal(controls.createPendingAdd(imported, day.id).trackingType, null));
check('UI no heuristic Bike default', () => assert.equal(controls.createPendingAdd(catalog.getExerciseById('9003'), day.id).trackingType, null));
check('UI lb translated to lbs', () => assert.equal(controls.createPendingAdd({ ...dbHip, supportedWeightUnits: ['lb'] }, day.id).weightUnit, 'lbs'));
check('UI switching nonweighted clears load', () => assert.equal(controls.changeAddTracking({ ...pendingAdd, weightUnit: 'kg' }, 'time_only').weightUnit, 'unitless'));
const configured = { ...controls.createPendingAdd(arm, day.id, 'warmup'), rawTarget: '15', rawSets: '2', rawRest: '75', restSeconds: 75 };
check('UI configured Add valid', () => assert.deepEqual(controls.pendingAddErrors(configured, arm, seed.days[0]), {}));
uiState.get().setPendingAdd(configured);
check('UI pending Add blocks Save', () => assert.equal(controls.canSaveEditor(uiState.get()), false));
const drawer = render(Drawer, { defaultRest: 90, onAdded() {}, onChooseAnother() {}, onCancel() {} });
for (const phrase of ['role="dialog"', 'aria-modal="true"', 'Section', 'Sets', 'Target / prescription', 'Tracking', 'Rest between sets', 'Custom rest (seconds)']) check(`UI Add drawer ${phrase}`, () => assert(drawer.includes(phrase)));
check('UI nonweighted Add hides irrelevant Load unit', () => assert(!drawer.includes('Load unit')));
uiState.get().commitPendingAdd();
const uiAdded = uiState.get().routine.days[0].exercises.find(value => !uiIds.includes(value.id));
check('UI Add rest 75 committed', () => assert.equal(uiAdded.restSeconds, 75));
check('UI Add canonical snapshots', () => assert.deepEqual([uiAdded.name, uiAdded.targetMuscle], [arm.displayName, arm.primaryMuscle]));
check('UI Add warmup insertion deterministic', () => assert.equal(uiState.get().routine.days[0].exercises.filter(value => value.section === 'warmup').at(-1).id, uiAdded.id));
uiState.get().removeOccurrence(uiAdded.id);
check('UI Add/Remove returns baseline', () => assert.equal(uiState.get().draftStatus, 'Saved'));
uiState.get().setPendingAdd({ ...configured, rawRest: '0' });
rejects('UI invalid raw Add rest cannot bypass button', () => uiState.get().commitPendingAdd());
check('UI rejected Add no new identity', () => assert.deepEqual(ids(uiState.get().routine), uiIds));
uiState.get().discardDraft();
check('UI built-in descriptions/source untouched', () => assert.deepEqual(templates.map(value => [value.id, value.description]), loader('src/data/built-in-routine-templates.ts').BUILT_IN_ROUTINE_TEMPLATES.map(value => [value.id, value.description])));

// Cardio amendment: canonical identity/category only; Zone remains presentation.
const cardioPresentation = loader('src/lib/routine-cardio-presentation.ts');
const cardioRoutine = materializer.materializeRoutineTemplate(templates[2]);
const cardioState = makeStore({ loaded: cardioRoutine }); await cardioState.get().fetchRoutine();
const cardioFingerprint = editor.routineFingerprint(cardioState.get().routine);
const cardioProjection = editor.persistedRoutineProjection(cardioState.get().routine);
const cardioPayload = model.routinePlanToRpcPayload(cardioState.get().routine);
const cardioDraftState = structuredClone([cardioState.get().draftStatus, cardioState.get().editorBuffers, cardioState.get().draftRevision]);
const bike = cardioRoutine.days[0].exercises.find(value => value.exerciseId === '9003');
const occurrenceMarkup = occurrence => render(OccurrenceEditor, { occurrence, expanded: true, canMoveUp: false, canMoveDown: false, isSaving: false, defaultRest: 90, onMove() {}, onRemove() {} });
for (const id of ['9003', '3666', '9001', '2141']) {
  const exercise = catalog.getExerciseById(id);
  check(`cardio canonical category ${id}`, () => assert.equal(cardioPresentation.isCatalogCardio(exercise), true));
  check(`cardio no display/equipment heuristic ${id}`, () => assert.equal(cardioPresentation.isCatalogCardio({ ...exercise, name: 'unrelated', displayName: 'unrelated', equipment: 'barbell', normalizedEquipment: 'barbell' }), true));
  const presentation = cardioPresentation.occurrenceProgrammingPresentation({ ...bike, exerciseId: id });
  check(`cardio resolves stable exerciseId ${id}`, () => assert.equal(presentation.continuous, true));
}
check('declared movementType cardio authoritative', () => assert.equal(cardioPresentation.isCatalogCardio({ movementType: 'cardio', bodyPart: 'waist' }), true));
check('declared noncardio overrides older category', () => assert.equal(cardioPresentation.isCatalogCardio({ movementType: 'stretch', bodyPart: 'cardio' }), false));
check('unknown identity never classified by name', () => assert.equal(cardioPresentation.occurrenceProgrammingPresentation({ ...bike, exerciseId: 'missing', name: 'Stationary Bike' }).cardio, false));
check('equipment/name alone insufficient', () => assert.equal(cardioPresentation.isCatalogCardio({ bodyPart: 'waist', name: 'Treadmill Bike', equipment: 'stationary bike' }), false));
for (const id of ['9008', 'vx_ex_bodyweight_side_plank', '1564', '2208', '2202']) {
  const occurrence = { ...bike, exerciseId: id, trackingType: 'time_only' };
  const presentation = cardioPresentation.occurrenceProgrammingPresentation(occurrence);
  check(`timed noncardio ${id}`, () => assert.equal(presentation.cardio, false));
  const markup = occurrenceMarkup(occurrence);
  check(`timed noncardio Sets label ${id}`, () => assert(markup.includes('>Sets</label>') && markup.includes('>Target / prescription</label>') && !markup.includes('Intensity Zone')));
}
for (const mode of ['time_only', 'time_weight', 'cardio_hr']) check(`continuous compatible duration mode ${mode}`, () => assert.equal(cardioPresentation.occurrenceProgrammingPresentation({ ...bike, trackingType: mode }).continuous, true));
for (const mode of ['reps_only', 'reps_weight']) check(`repetition mode not continuous ${mode}`, () => assert.equal(cardioPresentation.occurrenceProgrammingPresentation({ ...bike, trackingType: mode }).continuous, false));
const continuousCardio = occurrenceMarkup(bike);
check('continuous Duration full field', () => assert(continuousCardio.includes('>Duration / prescription</label>') && continuousCardio.includes('value="30 mins"')));
check('continuous count de-emphasized in disclosure', () => assert.match(continuousCardio, /aria-expanded="false" aria-controls="editor-sets:[\s\S]*Continuous cardio · Adjust rounds[\s\S]*>Rounds<\/label>/));
check('continuous never strength Sets label', () => assert(!continuousCardio.includes('>Sets</label>')));
const multiRoundCardio = occurrenceMarkup({ ...bike, targetSets: 3 });
check('multiround editable Rounds', () => assert(multiRoundCardio.includes('>Rounds</label>') && multiRoundCardio.includes('value="3"') && !multiRoundCardio.includes('<details')));
check('multiround preserves targetSets domain', () => assert.equal(bike.targetSets, 1));
for (const zone of [1, 2, 3, 4, 5]) {
  check(`explicit Zone ${zone} extraction`, () => assert.equal(cardioPresentation.explicitHeartRateZone(`Zone ${zone}. Context`), zone));
  check(`structured Zone ${zone} editable display`, () => assert(occurrenceMarkup({ ...bike, cardioZone: zone, note: 'Zone 2. Context' }).includes(`Zone ${zone}`)));
}
check('case insensitive zone token', () => assert.equal(cardioPresentation.explicitHeartRateZone('zOnE 2'), 2));
check('programming target text cannot override structured Zone', () => assert.equal(cardioPresentation.occurrenceProgrammingPresentation({ ...bike, targetValue: '30 mins Zone 5', note: undefined }).zone, 2));
for (const text of ['', 'easy aerobic hard', 'Zone 0', 'Zone 6', 'Zone 12', 'Zone2', 'Zone 2.5', 'Zone 2–3', 'Zone 2 / 3', 'Zone 2 to 3', 'Zone 1 or Zone 2']) {
  check(`no fabricated/partial/ambiguous zone ${text}`, () => assert.equal(cardioPresentation.explicitHeartRateZone(text), null));
  check(`structured None independent of text ${text}`, () => assert.equal(cardioPresentation.occurrenceProgrammingPresentation({ ...bike, cardioZone: null, targetValue: '30 mins', note: text }).zone, null));
}
check('conflicting text does not override structured Zone', () => assert.equal(cardioPresentation.occurrenceProgrammingPresentation({ ...bike, targetValue: '30 mins Zone 1', note: 'Zone 2' }).zone, 2));
check('strength Sets label unchanged', () => assert(occurrenceMarkup({ ...bike, exerciseId: '0025', targetSets: 4 }).includes('>Sets</label>')));
check('cardio notes remain verbatim', () => assert(continuousCardio.includes(bike.note)));
check('cardio rest control retained', () => { occurrenceMarkup(bike); assert(continuousCardio.includes('>Rest</label>') && continuousCardio.includes('Use Default') && lastSelect('Rest').options.some(value => value.value === 'custom')); });
check('cardio custom rest display 75', () => assert(occurrenceMarkup({ ...bike, restSeconds: 75 }).includes('Rest: 1 min 15 sec')));
for (const occurrence of cardioState.get().routine.days.flatMap(value => value.exercises)) {
  cardioPresentation.occurrenceProgrammingPresentation(occurrence);
  occurrenceMarkup(occurrence);
}
check('presentation leaves fingerprint unchanged', () => assert.equal(editor.routineFingerprint(cardioState.get().routine), cardioFingerprint));
check('presentation leaves projection unchanged', () => assert.deepEqual(editor.persistedRoutineProjection(cardioState.get().routine), cardioProjection));
check('presentation leaves RPC payload unchanged', () => assert.deepEqual(model.routinePlanToRpcPayload(cardioState.get().routine), cardioPayload));
check('presentation creates no dirty state/buffer/revision', () => assert.deepEqual([cardioState.get().draftStatus, cardioState.get().editorBuffers, cardioState.get().draftRevision], cardioDraftState));
uiState.get().setPendingAdd({ ...controls.createPendingAdd(catalog.getExerciseById('9003'), day.id), rawTarget: '20–25 mins' });
const cardioDrawer = render(Drawer, { defaultRest: 90, onAdded() {}, onChooseAnother() {}, onCancel() {} });
check('Add canonical cardio labels', () => assert(cardioDrawer.includes('>Rounds</label>') && cardioDrawer.includes('>Duration / prescription</label>')));
check('Add cardio explicit capability selection unchanged', () => assert.equal(uiState.get().pendingAdd.trackingType, null));
check('Add cardio rest Default/null unchanged', () => assert.equal(uiState.get().pendingAdd.restSeconds, null));
check('Add has structured Zone editor', () => { assert(cardioDrawer.includes('Intensity')); assert.deepEqual(lastSelect('Intensity').options.map(value => value.value), ['none', '1', '2', '3', '4', '5']); });
uiState.get().setPendingAdd(null);

// Contextual rest labels are copy only; existing control behavior is unchanged.
for (const [exerciseId, targetSets, trackingType, expected] of [
  ['9003', 1, 'time_only', 'Rest'], ['9003', 3, 'time_only', 'Rest between rounds'],
  ['0025', 4, 'reps_weight', 'Rest between sets'], ['vx_ex_bodyweight_squat', 3, 'reps_only', 'Rest between sets'],
  ['vx_ex_arm_swing', 2, 'reps_only', 'Rest between sets'], ['9008', 2, 'time_only', 'Rest between sets'],
  ['vx_ex_bodyweight_side_plank', 3, 'time_only', 'Rest between sets'], ['1564', 1, 'time_only', 'Rest between sets'],
  ['2208', 1, 'time_only', 'Rest between sets'],
]) {
  const occurrence = { ...bike, exerciseId, targetSets, trackingType };
  check(`contextual rest label ${exerciseId} / ${targetSets}`, () => assert(occurrenceMarkup(occurrence).includes(`>${expected}</label>`)));
}
const labelState = makeStore({ loaded: cardioRoutine }); await labelState.get().fetchRoutine();
const labelBike = labelState.get().routine.days[0].exercises.find(value => value.exerciseId === '9003');
const labelBefore = editor.routineFingerprint(labelState.get().routine);
occurrenceMarkup(labelBike);
check('label-only render stays Saved', () => assert.equal(labelState.get().draftStatus, 'Saved'));
check('label-only render preserves fingerprint', () => assert.equal(editor.routineFingerprint(labelState.get().routine), labelBefore));
labelState.get().updateOccurrence(labelBike.id, { targetSets: 3 });
const updatedLabelBike = () => labelState.get().routine.days[0].exercises.find(value => value.id === labelBike.id);
check('1 to 3 changes rest label', () => assert(occurrenceMarkup(updatedLabelBike()).includes('>Rest between rounds</label>')));
check('rounds edit preserves restSeconds', () => assert.equal(updatedLabelBike().restSeconds, null));
labelState.get().updateOccurrence(labelBike.id, { targetSets: 1 });
check('3 to 1 restores continuous rest label', () => assert(occurrenceMarkup(updatedLabelBike()).includes('>Rest</label>')));
check('rounds exact revert Saved', () => assert.equal(labelState.get().draftStatus, 'Saved'));
for (const rest of [null, 75]) {
  for (const label of ['Rest', 'Rest between rounds', 'Rest between sets']) {
    const markup = render(RestControl, { id: 'label-rest', label, raw: rest === null ? 'default' : String(rest), error: null, defaultRest: 90, onChange() {} });
    check(`label ${label} preserves rest display ${rest}`, () => assert(markup.includes(`Rest: ${controls.formatRest(rest)}`)));
    check(`label ${label} preserves presets/custom ${rest}`, () => assert.deepEqual(lastSelect(label).options.map(option => option.value), ['default', ...controls.REST_PRESETS.map(String), 'custom']));
  }
}
for (const [exerciseId, rawSets, label] of [['9003', '1', 'Rest'], ['9003', '3', 'Rest between rounds'], ['0025', '1', 'Rest between sets']]) {
  uiState.get().setPendingAdd({ ...controls.createPendingAdd(catalog.getExerciseById(exerciseId), day.id), rawSets });
  check(`Add contextual rest ${exerciseId} / ${rawSets}`, () => assert(render(Drawer, { defaultRest: 90, onAdded() {}, onChooseAnother() {}, onCancel() {} }).includes(`>${label}</label>`)));
  check('Add label leaves default null', () => assert.equal(uiState.get().pendingAdd.restSeconds, null));
}
uiState.get().setPendingAdd(null);

// Progressive disclosure is pure view state, not a second draft system.
const disclosure = loader('src/lib/routine-editor-presentation.ts');
const viewState = makeStore({ loaded: cardioRoutine }); await viewState.get().fetchRoutine();
const viewBefore = [editor.routineFingerprint(viewState.get().routine), viewState.get().draftRevision, viewState.get().draftStatus];
const viewPayload = model.routinePlanToRpcPayload(viewState.get().routine);
let view = disclosure.INITIAL_EDITOR_DISCLOSURE;
check('overview initially collapsed', () => assert.equal(view.dayId, null));
check('no occurrence initially editing', () => assert.equal(view.occurrenceId, null));
const viewDay = viewState.get().routine.days[0];
const viewFirst = viewDay.exercises[0], viewSecond = viewDay.exercises[1];
for (const action of [
  { kind: 'day', dayId: viewDay.id },
  { kind: 'occurrence', dayId: viewDay.id, occurrenceId: viewFirst.id },
  { kind: 'occurrence', dayId: viewDay.id, occurrenceId: viewSecond.id },
  { kind: 'done' }, { kind: 'day-settings', dayId: viewDay.id }, { kind: 'done' },
  { kind: 'reorder', dayId: viewDay.id, section: 'warmup' }, { kind: 'done' },
  { kind: 'routine-settings' }, { kind: 'done' }, { kind: 'day', dayId: viewDay.id },
]) {
  const old = structuredClone(view);
  const result = disclosure.transitionDisclosure(view, action, {});
  check(`disclosure ${action.kind} input state immutable`, () => assert.deepEqual(view, old));
  view = result.state;
  check(`disclosure ${action.kind} projection/revision/dirty untouched`, () => assert.deepEqual([editor.routineFingerprint(viewState.get().routine), viewState.get().draftRevision, viewState.get().draftStatus], viewBefore));
  check(`disclosure ${action.kind} no persistence`, () => assert.equal(viewState.writes(), 0));
  if (action.kind === 'occurrence') check(`single active occurrence ${action.occurrenceId}`, () => assert.deepEqual([view.occurrenceId, view.daySettingsId, view.reorder, view.routineSettings], [action.occurrenceId, null, null, false]));
}
check('disclosure leaves RPC payload unchanged', () => assert.deepEqual(model.routinePlanToRpcPayload(viewState.get().routine), viewPayload));
for (const field of [
  { kind: 'sets', occurrenceId: viewFirst.id }, { kind: 'target', occurrenceId: viewFirst.id },
  { kind: 'rest', occurrenceId: viewFirst.id }, { kind: 'day-title', dayId: viewDay.id }, { kind: 'routine-name' },
]) {
  viewState.get().setEditorBuffer(field, '');
  const buffers = viewState.get().editorBuffers;
  const opened = disclosure.revealEditorError(disclosure.INITIAL_EDITOR_DISCLOSURE, viewState.get().routine, buffers);
  check(`invalid ${field.kind} remount reveals correct editor`, () => assert(field.kind === 'routine-name' ? opened.routineSettings : field.kind === 'day-title' ? opened.daySettingsId === viewDay.id : opened.occurrenceId === viewFirst.id));
  for (const action of [{ kind: 'done' }, { kind: 'day', dayId: viewDay.id }, { kind: 'occurrence', dayId: viewDay.id, occurrenceId: viewSecond.id }, { kind: 'reorder', dayId: viewDay.id, section: 'main' }]) {
    const result = disclosure.transitionDisclosure(opened, action, buffers);
    check(`invalid ${field.kind} blocks ${action.kind}`, () => assert.strictEqual(result.state, opened));
    check(`invalid ${field.kind} identifies field to focus`, () => assert.deepEqual(result.blockedField, field));
  }
  check(`invalid ${field.kind} buffer preserved`, () => assert.equal(Object.values(viewState.get().editorBuffers)[0].raw, ''));
  viewState.get().discardDraft();
}
check('invalid rest focus maps custom input', () => assert.equal(disclosure.editorErrorInputId({ kind: 'rest', occurrenceId: 'test' }), 'rest-test-custom'));
check('valid buffer permits Done without discard', () => {
  viewState.get().setEditorBuffer({ kind: 'target', occurrenceId: viewFirst.id }, '25 mins');
  assert.equal(disclosure.transitionDisclosure({ ...view, occurrenceId: viewFirst.id }, { kind: 'done' }, viewState.get().editorBuffers).blockedField, null);
  assert.equal(Object.values(viewState.get().editorBuffers)[0].raw, '25 mins');
});
viewState.get().discardDraft();
const compactProps = { occurrence: bike, canMoveUp: false, canMoveDown: true, defaultRest: 90, isSaving: false, onMove() {}, onRemove() {}, onEdit() {}, onDone() {} };
const compactCard = render(OccurrenceEditor, compactProps);
check('compact card has no programming input', () => assert(!compactCard.includes('<input')));
check('compact card has no Remove or Move controls', () => assert(!compactCard.includes('aria-label="Remove ') && !compactCard.includes('aria-label="Move ')));
check('compact cardio duration no set emphasis', () => assert(compactCard.includes('30 mins') && !compactCard.includes('1 ×')));
check('compact cardio explicit intensity accessible', () => assert(compactCard.includes('aria-label="Intensity Zone 2"')));
check('compact notes indicator not full content', () => assert(compactCard.includes('>Note<') && !compactCard.includes('Aerobic base building')));
check('compact rest Default inheritance clear', () => assert(compactCard.includes('Rest: Default')));
check('compact Edit accessible and touch target', () => assert(compactCard.includes(`aria-label="Edit ${bike.name}"`) && compactCard.includes('min-h-11')));
const expandedCard = render(OccurrenceEditor, { ...compactProps, expanded: true });
check('expanded note verbatim retained', () => assert(expandedCard.includes(bike.note)));
check('expanded Remove accessible', () => assert(expandedCard.includes(`aria-label="Remove ${bike.name}"`)));
check('expanded Done communicates local-only', () => assert(expandedCard.includes('Done closes this card') && expandedCard.includes('Save Changes')));
check('expanded has no permanent move clutter', () => assert(!expandedCard.includes('aria-label="Move ')));
const reorderCard = render(OccurrenceEditor, { ...compactProps, reordering: true });
check('reorder compact controls without forms', () => assert(!reorderCard.includes('<input') && reorderCard.includes('aria-label="Move ')));
check('reorder boundary disabled', () => assert.match(reorderCard, /disabled=""[^>]*aria-label="Move /));
const compactDay = render(DayEditor, { ...dayProps, settingsOpen: false, activeOccurrenceId: null });
check('expanded day defaults to compact cards', () => assert(!compactDay.includes('<input')));
check('expanded day settings hidden until request', () => assert(compactDay.includes('Edit day') && !compactDay.includes('>Day title</label>')));
check('single active occurrence renders one visible form panel', () => assert.equal((render(DayEditor, { ...dayProps, activeOccurrenceId: first.id }).match(/<div id="occurrence-editor-[^"]+">/g) ?? []).length, 1));
check('day Reorder accessible pressed state', () => assert(compactDay.includes('aria-pressed="false"') && compactDay.includes('Reorder Warm-up')));
check('chevron inset and aligned target', () => assert(compactDay.includes('p-4') && compactDay.includes('h-11 w-11')));
check('compact routine has no name field', () => assert(!render(Information, { name: seed.name, count: 64, expanded: false, onEdit() {}, onDone() {} }).includes('<input')));
check('editor uses no native selects', () => assert(![expandedCard, settingsMarkup, cardioDrawer].some(markup => markup.includes('<select'))));
check('shared Select exposes labelled combobox semantics', () => assert(expandedCard.includes('role="combobox"') && expandedCard.includes('aria-haspopup="listbox"')));
const invalidRoundsBike = uiState.get().routine.days[0].exercises.find(item => item.exerciseId === '9003');
uiState.get().setEditorBuffer({ kind: 'sets', occurrenceId: invalidRoundsBike.id }, '0');
const invalidRoundsMarkup = occurrenceMarkup(invalidRoundsBike);
check('invalid continuous rounds cannot hide error', () => assert(invalidRoundsMarkup.includes(`id="editor-sets:${invalidRoundsBike.id}"`) && invalidRoundsMarkup.includes('aria-invalid="true"') && invalidRoundsMarkup.includes('value="0"')));
check('invalid continuous rounds field stays visible', () => assert(!invalidRoundsMarkup.includes(`id="rounds-${invalidRoundsBike.id}" hidden`)));
uiState.get().discardDraft();
check('custom selects preserve exact rest values', () => { render(RestControl, { id: 'disclosure-rest', label: 'Rest', raw: '75', onChange() {}, defaultRest: 90 }); assert.deepEqual(lastSelect('Rest').options.map(option => option.value), ['default', '30', '45', '60', '90', '120', '180', 'custom']); });
for (const [occurrence, expected] of [[{ ...bike, exerciseId: '0025', targetSets: 4, targetValue: '6–8', weightUnit: 'kg' }, '4 × 6–8'], [bike, '30 mins'], [{ ...bike, targetSets: 3 }, '3 Rounds · 30 mins'], [{ ...bike, exerciseId: '1564', targetValue: '3 mins total' }, '1 × 3 mins total']]) {
  const before = structuredClone(occurrence);
  check(`compact summary ${expected}`, () => assert.equal(disclosure.compactOccurrenceSummary(occurrence).prescription, expected));
  check('summary never mutates programming', () => assert.deepEqual(occurrence, before));
}
// D2D-B: actual shared domain, adapters, buffers, save lifecycle and hydration.
const prog = loader('src/lib/routine-programming.ts');
const clean = materializer.materializeRoutineTemplate(templates[2]);
const cleanBike = clean.days[0].exercises.at(-1);
const getOccurrence = (routine, id) => routine.days.flatMap(d => d.exercises).find(e => e.id === id);
for (const zone of [null, 1, 2, 3, 4, 5]) {
  const changed = editor.setOccurrenceCardioZone(clean, cleanBike.id, zone);
  const occurrence = getOccurrence(changed, cleanBike.id);
  check(`Zone ${zone} pure operation`, () => assert.deepEqual(occurrence, { ...cleanBike, cardioZone: zone }));
  check(`Zone ${zone} JSON includes exact key`, () => assert.equal(JSON.parse(JSON.stringify(model.routinePlanToRpcPayload(changed))).days[0].exercises.at(-1).cardioZone, zone));
  const legacy = model.routinePlanToLegacyPlan(changed);
  check(`Zone ${zone} export includes key`, () => assert(Object.hasOwn(legacy[0].mainLifts.at(-1), 'cardioZone')));
  check(`Zone ${zone} import exact roundtrip`, () => assert.equal(model.legacyPlanToRoutinePlan('Synthetic', legacy).days[0].exercises.at(-1).cardioZone, zone));
  const state = makeStore({ loaded: changed }); await state.get().fetchRoutine();
  check(`Zone ${zone} custom template saved`, () => assert(state.get().saveCustomTemplate('Synthetic', '', changed)));
  check(`Zone ${zone} custom value retained`, () => assert.equal(state.get().customTemplates[0].plan[0].mainLifts.at(-1).cardioZone, zone));
  await state.get().applyTemplate(state.get().customTemplates[0].id);
  check(`Zone ${zone} custom Apply value retained`, () => assert.equal(state.submissions.at(-1).days[0].exercises.at(-1).cardioZone, zone));
  const encoded = state.get().exportRoutine();
  check(`Zone ${zone} encoded export exact`, () => assert.equal(JSON.parse(decodeURIComponent(atob(encoded)))[0].mainLifts.at(-1).cardioZone, zone));
  await state.get().importRoutine(encoded);
  check(`Zone ${zone} encoded import submits key`, () => assert.equal(state.submissions.at(-1).days[0].exercises.at(-1).cardioZone, zone));
  const pending = { ...controls.createPendingAdd(catalog.getExerciseById('9003'), clean.days[0].id), rawTarget: '30 mins', trackingType: 'time_only', weightUnit: 'unitless', cardioZone: zone };
  const addStore = makeStore({ loaded: clean }); await addStore.get().fetchRoutine(); addStore.get().setPendingAdd(pending); addStore.get().commitPendingAdd();
  check(`Add Zone ${zone} exact`, () => assert.equal(addStore.get().routine.days[0].exercises.at(-1).cardioZone, zone));
}
for (const invalid of [undefined, 0, 6, -1, 2.5, '2', true, {}, []]) {
  rejects(`canonical invalid Zone ${JSON.stringify(invalid)}`, () => { const value = structuredClone(clean); value.days[0].exercises.at(-1).cardioZone = invalid; model.routinePlanToRpcPayload(value); });
  rejects('invalid present legacy Zone', () => prog.normalizeLegacyCardioZone({ exerciseId: '9003', cardioZone: invalid, note: 'Zone 2' }));
}
for (const [id, target, note, expected] of [
  ['9003', '', 'Zone 1', 1], ['9001', '', 'Zone 2', 2], ['3666', 'Zone 5', '', 5], ['2141', '', 'zOnE 3', 3],
  ['9003', 'Zone 2', 'Zone 2', 2], ['9003', 'Zone 1', 'Zone 2', null], ['9003', '', 'Zone 6', null],
  ['9003', '', 'Zone 2 / Zone 6', null], ['9003', '', 'Zone 2.5', null], ['9003', '', 'Zone 2–3', null],
  ['9003', '', 'Zone 2 to 3', null], ['9003', '', 'Zone 02', null], ['9003', 'Zone', '2', null],
  ['9003', '', 'easy aerobic recovery hard RPE heart rate', null], ['9003', '', 'Timezone 2', null],
  ['9008', '', 'Zone 2', null], ['unknown', '', 'Zone 2', null], [null, '', 'Zone 2', null],
]) check(`strict legacy ${id}/${target}/${note}`, () => assert.equal(prog.normalizeLegacyCardioZone({ exerciseId: id, targetValue: target, note }), expected));
check('explicit null suppresses legacy', () => assert.equal(prog.normalizeLegacyCardioZone({ exerciseId: '9003', cardioZone: null, note: 'Zone 2' }), null));
check('structured Zone wins over legacy', () => assert.equal(prog.normalizeLegacyCardioZone({ exerciseId: '9003', cardioZone: 4, note: 'Zone 2' }), 4));
const oldLegacy = model.routinePlanToLegacyPlan(clean); delete oldLegacy[0].mainLifts.at(-1).cardioZone;
const oldTemplate = { id: 'cust_legacy', name: 'Legacy', description: 'Synthetic', plan: oldLegacy };
const customState = makeStore();
const mergedCustom = customState.options.merge({ customTemplates: [oldTemplate] }, customState.get());
check('custom hydration preserves version 1', () => assert.equal(customState.options.version, 1));
check('custom hydration preserves IDs/notes', () => assert.deepEqual(mergedCustom.customTemplates[0].plan[0].mainLifts.at(-1), { ...oldLegacy[0].mainLifts.at(-1), cardioZone: 2 }));
check('custom hydration preserves template ID', () => assert.equal(mergedCustom.customTemplates[0].id, oldTemplate.id));
for (const [id, expected] of [['9003', '1'], ['3666', '1'], ['9001', '1'], ['2141', '1'], ['0025', '3'], ['9008', '3']]) {
  check(`Add ${id} count default`, () => assert.equal(controls.createPendingAdd(catalog.getExerciseById(id), day.id).rawSets, expected));
}
check('unit domain exactly four', () => assert.deepEqual(prog.PROGRAMMING_WEIGHT_UNITS, ['kg', 'lbs', 'plates', 'unitless']));
check('tracking domain exactly five', () => assert.deepEqual(prog.PROGRAMMING_TRACKING_TYPES, model.TRACKING_TYPES));
check('atomic config cannot mutate unrelated fields through extra runtime keys', () => assert.deepEqual(
  getOccurrence(editor.setOccurrenceTrackingConfig(clean, cleanBike.id, { trackingType: 'cardio_hr', weightUnit: 'unitless', id: 'not-allowed', cardioZone: 5, note: 'not-allowed', restSeconds: 75 }), cleanBike.id),
  { ...cleanBike, trackingType: 'cardio_hr', weightUnit: 'unitless' }));
check('catalog lb maps to lbs', () => assert.equal(prog.catalogUnitToRoutineUnit('lb'), 'lbs'));
const press = catalog.getExerciseCatalog().find(e => e.displayName === 'Machine Leg Press');
const cable = catalog.getExerciseById('vx_ex_face_pull');
check('leg press declared units only', () => assert.deepEqual(prog.programmingOptions(press, 'reps_weight').units, ['kg', 'lbs']));
check('cable plates declared', () => assert(prog.programmingOptions(cable, 'reps_weight').units.includes('plates')));
rejects('leg press arbitrary alternate mode rejected', () => prog.validateCompatibleTracking(press, { trackingType: 'time_weight', weightUnit: 'kg' }));
rejects('leg press plates not invented', () => prog.validateCompatibleTracking(press, { trackingType: 'reps_weight', weightUnit: 'plates' }));
const historical = { trackingType: 'time_weight', weightUnit: 'plates' };
check('exact historical pair preserved', () => prog.validateCompatibleTracking(press, historical, historical));
check('historical options scoped to exact pair', () => assert.deepEqual(prog.programmingOptions(press, 'time_weight', historical).units, ['plates']));
rejects('historical pair does not broaden cross products', () => prog.validateCompatibleTracking(press, { trackingType: 'time_weight', weightUnit: 'kg' }, historical));
for (const mode of model.TRACKING_TYPES) for (const unit of model.WEIGHT_UNITS) {
  const config = { trackingType: mode, weightUnit: unit };
  const valid = prog.isWeightedMode(mode) ? unit !== 'unitless' : unit === 'unitless';
  if (valid) {
    check(`imported explicit ${mode}/${unit}`, () => prog.validateCompatibleTracking(catalog.getExerciseById('9003'), config));
    const edited = editor.setOccurrenceTrackingConfig(clean, cleanBike.id, config);
    check(`${mode}/${unit} preserves unrelated programming`, () => assert.deepEqual(getOccurrence(edited, cleanBike.id), { ...cleanBike, ...config }));
  } else rejects(`invalid pair ${mode}/${unit}`, () => prog.validateTrackingConfig(config));
}
const parity = makeStore({ loaded: clean }); await parity.get().fetchRoutine();
const zoneField = { kind: 'zone', occurrenceId: cleanBike.id };
const configField = { kind: 'tracking-config', occurrenceId: cleanBike.id };
const parityCommit = (field, raw) => { parity.get().setEditorBuffer(field, raw); controls.commitEditorInput(field, raw, parity.get(), parity.get().routine.days); };
for (const raw of ['3', 'none', '1', '5', '2']) {
  parityCommit(zoneField, raw);
  check(`Zone buffer ${raw} dirty/revert`, () => assert.equal(parity.get().draftStatus, raw === '2' ? 'Saved' : 'Unsaved changes'));
}
const lastValid = editor.routineFingerprint(parity.get().routine);
const incomplete = prog.transitionTracking({ trackingType: 'time_only', weightUnit: 'unitless' }, 'time_weight', ['kg', 'lbs', 'plates']);
check('non-weighted to weighted requires choice', () => assert.equal(incomplete.weightUnit, null));
parity.get().setEditorBuffer(configField, prog.encodeTrackingConfig(incomplete));
check('incomplete config does not mutate graph', () => assert.equal(editor.routineFingerprint(parity.get().routine), lastValid));
check('incomplete config blocks Save', () => assert.equal(controls.canSaveEditor(parity.get()), false));
await rejectsAsync('incomplete config cannot save', () => parity.get().saveRoutineToDb());
for (const action of [{ kind: 'done' }, { kind: 'occurrence', dayId: clean.days[0].id, occurrenceId: clean.days[0].exercises[0].id }]) {
  const open = { ...disclosure.INITIAL_EDITOR_DISCLOSURE, dayId: clean.days[0].id, occurrenceId: cleanBike.id };
  check('incomplete config blocks Done/switch', () => assert.strictEqual(disclosure.transitionDisclosure(open, action, parity.get().editorBuffers).state, open));
}
check('incomplete config focuses load unit', () => assert.equal(disclosure.editorErrorInputId(configField, parity.get().editorBuffers), `editor-tracking-config:${cleanBike.id}-unit`));
for (const unit of ['kg', 'lbs', 'plates']) {
  parityCommit(configField, prog.encodeTrackingConfig({ trackingType: 'time_weight', weightUnit: unit }));
  check(`atomic weighted ${unit}`, () => assert.equal(getOccurrence(parity.get().routine, cleanBike.id).weightUnit, unit));
}
const nonWeighted = prog.transitionTracking({ trackingType: 'time_weight', weightUnit: 'plates' }, 'cardio_hr', ['unitless']);
check('weighted to non-weighted atomically unitless', () => assert.deepEqual(nonWeighted, { trackingType: 'cardio_hr', weightUnit: 'unitless' }));
parityCommit(configField, prog.encodeTrackingConfig(nonWeighted));
check('tracking keeps Zone/notes/rest/target', () => assert.deepEqual(getOccurrence(parity.get().routine, cleanBike.id), { ...cleanBike, ...nonWeighted }));
parityCommit(configField, prog.encodeTrackingConfig({ trackingType: cleanBike.trackingType, weightUnit: cleanBike.weightUnit }));
check('tracking exact revert Saved', () => assert.equal(parity.get().draftStatus, 'Saved'));
check('editing/Done never persisted implicitly', () => assert.equal(parity.writes(), 0));
parity.get().setOccurrenceCardioZone(cleanBike.id, 3);
await parity.get().saveRoutineToDb();
const freshZone = makeStore({ loaded: parity.submissions.at(-1) }); await freshZone.get().fetchRoutine();
check('Zone fresh store reload exact', () => assert.equal(getOccurrence(freshZone.get().routine, cleanBike.id).cardioZone, 3));
check('Zone discard restores saved value', () => { freshZone.get().setOccurrenceCardioZone(cleanBike.id, null); freshZone.get().discardDraft(); assert.equal(getOccurrence(freshZone.get().routine, cleanBike.id).cardioZone, 3); });
const flight = deferred(); const newer = makeStore({ loaded: clean, save: () => flight.promise }); await newer.get().fetchRoutine();
newer.get().setOccurrenceCardioZone(cleanBike.id, 3); const one = newer.get().saveRoutineToDb(); const two = newer.get().saveRoutineToDb();
check('Zone duplicate Save single flight', () => assert.strictEqual(one, two));
newer.get().setOccurrenceTrackingConfig(cleanBike.id, { trackingType: 'time_weight', weightUnit: 'plates' });
newer.get().setOccurrenceCardioZone(cleanBike.id, null); flight.resolve(newer.submissions[0]); await one;
check('newer Zone retained after stale save', () => assert.equal(getOccurrence(newer.get().routine, cleanBike.id).cardioZone, null));
check('newer tracking retained after stale save', () => assert.equal(getOccurrence(newer.get().routine, cleanBike.id).weightUnit, 'plates'));
check('stale save leaves dirty', () => assert.equal(newer.get().draftStatus, 'Unsaved changes'));
let failZone = true; const retryZone = makeStore({ loaded: clean, save: async routine => { if (failZone) throw new Error('Synthetic failure'); return routine; } }); await retryZone.get().fetchRoutine();
retryZone.get().setOccurrenceCardioZone(cleanBike.id, 4); await rejectsAsync('Zone failure remains explicit', () => retryZone.get().saveRoutineToDb());
check('Zone failure draft preserved', () => assert.equal(getOccurrence(retryZone.get().routine, cleanBike.id).cardioZone, 4));
failZone = false; await retryZone.get().saveRoutineToDb(); check('Zone retry Saved', () => assert.equal(retryZone.get().draftStatus, 'Saved'));
workout.getState().startWorkout('Synthetic zone snapshot', clean.days[0].exercises);
check('workout start copies Zone', () => assert.equal(workout.getState().exercises.at(-1).cardioZone, 2));
check('workout start preserves read-only note', () => assert.equal(workout.getState().exercises.at(-1).note, cleanBike.note));
freshZone.get().setOccurrenceCardioZone(cleanBike.id, 5);
check('routine Zone edit cannot affect snapshot', () => assert.equal(workout.getState().exercises.at(-1).cardioZone, 2));
check('workout store version 4', () => assert.equal(workoutPersistence.version, 4));
const legacyWorkout = { ...structuredClone(Object.fromEntries(Object.entries(workout.getState()).filter(([, value]) => typeof value !== 'function'))), restEndsAt: 12345, restCycleId: 'synthetic-cycle', restTimeRemaining: 75,
  operationId: 'synthetic-operation', completionStatus: 'queued', completionRequest: { synthetic: true },
  handledEffectOperationIds: ['synthetic-handled'], lastWorkoutSummary: { operationId: 'synthetic-summary' } };
delete legacyWorkout.exercises.at(-1).cardioZone;
const migratedWorkout = workoutPersistence.migrate(structuredClone(legacyWorkout), 3);
check('legacy workout missing Zone normalizes null', () => assert.equal(migratedWorkout.exercises.at(-1).cardioZone, null));
check('workout legacy migration preserves all other fields', () => assert.deepEqual(migratedWorkout, { ...legacyWorkout, exercises: legacyWorkout.exercises.map(e => ({ ...e, cardioZone: e.cardioZone ?? null })) }));
for (const value of [1, 2, 3, 4, 5, null, undefined, 0, 6, '2', true]) {
  const fixture = structuredClone(legacyWorkout); fixture.exercises.at(-1).cardioZone = value;
  check(`workout hydration Zone ${value}`, () => assert.equal(workoutPersistence.merge(fixture, workout.getState()).exercises.at(-1).cardioZone, [1, 2, 3, 4, 5].includes(value) ? value : null));
}
workout.getState().addExerciseToWorkout('Synthetic ad hoc'); check('ad hoc Zone null', () => assert.equal(workout.getState().exercises.at(-1).cardioZone, null));
const authoritativeNullRows = structuredClone(reloaded); authoritativeNullRows.days[0].exercises.at(-1).cardioZone = null;
check('normal render never infers note Zone', () => assert.equal(loader('src/lib/routine-cardio-presentation.ts').occurrenceProgrammingPresentation(authoritativeNullRows.days[0].exercises.at(-1)).zone, null));
const originalNote = cleanBike.note;
check('full original note preserved with provenance', () => { const markup = occurrenceMarkup({ ...cleanBike, cardioZone: 3 }); assert(markup.includes(originalNote)); assert(markup.includes('Original source wording')); assert(markup.includes('Zone 3')); });
for (const id of ['9008', '9009', '1564', 'vx_ex_intermediate_hip_flexor_quad_stretch']) {
  const resolved = catalog.getExerciseById(id); if (!resolved) continue;
  check(`non-cardio ${id} no Intensity control`, () => assert(!occurrenceMarkup({ ...cleanBike, exerciseId: id, name: resolved.displayName, cardioZone: null }).includes('>Intensity</label>')));
}
check('Add/Edit share six Zone options', () => { uiState.get().setPendingAdd({ ...controls.createPendingAdd(catalog.getExerciseById('9003'), day.id), trackingType: 'time_only', weightUnit: 'unitless' }); render(Drawer, { open: true, dayId: day.id, defaultRest: 90, onClose() {} }); const addOptions = lastSelect('Intensity').options; occurrenceMarkup(cleanBike); assert.deepEqual(lastSelect('Intensity').options, addOptions); uiState.get().setPendingAdd(null); });
const aiRoutine = loader('src/lib/ixia-ai.ts').generateRoutine('hypertrophy', 'ppl');
check('AI generated programming explicitly null', () => assert(Object.values(aiRoutine).flat().every(e => Object.hasOwn(e, 'cardioZone') && e.cardioZone === null)));
const dbNull = structuredClone(model.routinePlanToRpcPayload(clean)); dbNull.days[0].exercises.at(-1).cardioZone = null;
const dbNullRoutine = model.routinePlanFromRows({ routine: { id: dbNull.id, name: dbNull.name },
  days: dbNull.days.map(d => ({ id: d.id, routine_id: dbNull.id, day_name: model.weekdayLabel(d.weekday), type: d.kind, title: d.title })),
  exercises: dbNull.days.flatMap(d => d.exercises.map(e => ({ id: e.id, routine_day_id: d.id, exercise_id: e.exercise_id, name: e.name, type: e.target_muscle,
    tracking_style: e.tracking_type, weight_unit: e.weight_unit, target_sets: e.target_sets, target_reps: e.target_value, rest_seconds: e.rest_seconds,
    cardio_zone: e.cardioZone, note: e.note, is_warmup: e.section === 'warmup', order_index: e.order }))) });
check('DB null stays null despite legacy Zone note', () => assert.equal(dbNullRoutine.days[0].exercises.at(-1).cardioZone, null));
let historicalGraph = structuredClone(clean);
const historicalId = historicalGraph.days[0].exercises[3].id, ordinaryId = historicalGraph.days[0].exercises[4].id;
Object.assign(getOccurrence(historicalGraph, historicalId), { exerciseId: 'vx_ex_face_pull', trackingType: 'time_weight', weightUnit: 'kg' });
Object.assign(getOccurrence(historicalGraph, ordinaryId), { exerciseId: 'vx_ex_face_pull', trackingType: 'reps_weight', weightUnit: 'plates' });
const historicalStore = makeStore({ load: () => structuredClone(historicalGraph) }); await historicalStore.get().fetchRoutine();
check('historical occurrence offers its original pair', () => assert.deepEqual(historicalStore.get().occurrenceProgrammingOptions(historicalId, 'time_weight').units, ['kg']));
check('historical exception is not global', () => assert(!historicalStore.get().occurrenceProgrammingOptions(ordinaryId, 'time_weight').trackingTypes.includes('time_weight')));
historicalStore.get().setOccurrenceTrackingConfig(historicalId, { trackingType: 'reps_weight', weightUnit: 'plates' });
historicalStore.get().setOccurrenceTrackingConfig(historicalId, { trackingType: 'time_weight', weightUnit: 'kg' });
check('historical exact revert Saved', () => assert.equal(historicalStore.get().draftStatus, 'Saved'));
rejects('historical pair cannot broaden another occurrence', () => historicalStore.get().setOccurrenceTrackingConfig(ordinaryId, { trackingType: 'time_weight', weightUnit: 'kg' }));
Object.assign(getOccurrence(historicalGraph, historicalId), { trackingType: 'reps_only', weightUnit: 'unitless' });
await historicalStore.get().fetchRoutine();
check('fresh trusted load refreshes allowance', () => assert.deepEqual(historicalStore.get().occurrenceProgrammingOptions(historicalId, 'reps_only').units, ['unitless']));
check('fresh load does not retain obsolete allowance', () => assert(!historicalStore.get().occurrenceProgrammingOptions(historicalId, 'time_weight').trackingTypes.includes('time_weight')));
for (const invalid of [undefined, 0, 6, '2', true]) rejects('template requires valid explicit Zone', () => { const copy = structuredClone(templates); copy[0].days[0].occurrences[0].cardioZone = invalid; materializer.validateRoutineTemplates(copy); });
console.log(`Routine editor validation passed: ${positive} positive assertions, ${negative} negative fixtures.`);
console.log('Actual domain operations, Zustand actions, guard bridge, D1 serialization and active workout snapshot exercised.');
console.log('Deterministic single-flight / subscriber reentry / stale domain+buffer / failure+retry / cancellation+stale approval fixtures passed.');
console.log('No network, database, Production, or localStorage writes.');
