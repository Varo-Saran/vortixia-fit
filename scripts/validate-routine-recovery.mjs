import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { localTypeScriptLoader } from './lib/load-local-typescript.mjs';
import { owner, identity, rowsFromRoutine, legacyPplRoutine } from './fixtures/routine-compatibility.mjs';

let positive = 0, negative = 0;
const check = (name, test) => { try { test(); positive++; } catch (error) { error.message = `${name}: ${error.message}`; throw error; } };
const no = async (name, test) => { await assert.rejects(test, undefined, name); negative++; };
const load = localTypeScriptLoader(), model = load('src/lib/routine-model.ts'), compat = load('src/lib/routine-compatibility.ts'), recovery = load('src/lib/routine-recovery.ts');
const rows = rowsFromRoutine(legacyPplRoutine()), ctx = { subjectId: owner, generation: 1, source: 'database' };
const result = (input = rows, generation = 1) => compat.routineLoadResultFromRows(input, { ...ctx, generation });
const legacy = await result(), ids = legacy.issues.map(issue => issue.target.occurrenceId);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function harness({ save, read, initial = legacy } = {}) {
  let subjectListener, writes = 0, persisted = null, fetches = 0;
  const local = localTypeScriptLoader({ 'zustand/middleware': { persist: initializer => initializer }, '@/lib/routine-persistence': {
    observeRoutineSubject: callback => { subjectListener = callback; return () => {}; },
    loadActiveRoutine: async generation => { fetches++; return read ? read({ generation, fetches, persisted }) : persisted ? result(rowsFromRoutine(persisted), generation) : initial; },
    saveActiveRoutine: async (plan, subject) => { assert.equal(subject, owner); writes++; persisted = save ? await save(plan) : model.prepareRoutinePlanForSave(plan); return persisted; },
  } });
  const store = local('src/store/useRoutineStore.ts').useRoutineStore, guard = local('src/lib/routine-draft-guard.ts');
  return { local, store, get: store.getState, writes: () => writes, fetches: () => fetches, subject: value => subjectListener(value), guard };
}
const fix = h => ids.forEach(id => h.get().setRecoveryTrackingConfig(id, { trackingType: 'reps_weight', weightUnit: 'kg' }));
const h = harness(); await h.get().fetchRoutine();
check('legacy clean needs attention', () => assert.deepEqual([h.get().loadStatus, h.get().isDirty, h.get().compatibilityIssues.length], ['needs_attention', false, 2]));
check('recovery start/add blocked with replacement reachable', () => { const c = compat.routineCapabilities(h.get()); assert.deepEqual([c.canStartWorkout,c.canAddExercise,c.canReset,c.canApplyTemplate], [false,false,true,true]); });
await no('workout handler cannot launch recoverable', async () => recovery.workoutDaySelection(h.get(), legacy.routine.days[0].id));
h.get().setRecoveryTrackingBuffer(ids[0], { trackingType: 'reps_weight', weightUnit: null });
check('invalid weighted choice buffered without graph mutation', () => assert.deepEqual(h.get().readGraph, legacy.routine));
check('actual changed buffer dirty and Save blocked', () => assert(h.get().hasUnsavedChanges && !compat.routineCapabilities(h.get()).canSave));
h.get().discardDraft();
check('Discard removes buffer and restores original issues', () => assert.deepEqual([h.get().readGraph,h.get().editorBuffers,h.get().compatibilityIssues], [legacy.routine,{},legacy.issues]));
h.get().setRecoveryTrackingConfig(ids[0], { trackingType: 'reps_weight', weightUnit: 'lbs' });
check('one fixed leaves one issue and Save blocked', () => assert.equal(h.get().compatibilityIssues.length === 1 && !compat.routineCapabilities(h.get()).canSave, true));
h.get().setRecoveryTrackingConfig(ids[1], { trackingType: 'reps_weight', weightUnit: 'plates' });
check('both fixed enables Save but not workout/add', () => { const c = compat.routineCapabilities(h.get()); assert.deepEqual([c.canSave,c.canStartWorkout,c.canAddExercise], [true,false,false]); });
await h.get().saveRoutineToDb();
check('one authoritative write and verified reread installs ready', () => assert.deepEqual([h.writes(),h.fetches(),h.get().loadStatus,h.get().readGraph], [1,2,'ready',null]));
check('workout allowed only after persisted validation', () => assert.equal(compat.routineCapabilities(h.get()).canStartWorkout,true));
check('strict saved pairs preserve explicit choices', () => assert.deepEqual(h.get().routine.days.flatMap(day => day.exercises).filter(item => ids.includes(item.id)).map(item => item.weightUnit), ['lbs','plates']));

const backup = await recovery.createRecoveryBackup(legacy.source, '2026-01-01T00:00:00.000Z');
check('backup version/source exactly original', () => assert.deepEqual([backup.version,backup.source.rows], [1,rows]));
check('backup deeply immutable', () => assert(Object.isFrozen(backup.source.rows.exercises[0])));
check('snapshot metadata no secrets', () => assert.deepEqual(Object.keys(backup.source).sort(), ['fingerprint','generation','rows','source','subjectId']));
await no('backup injected token rejected', () => recovery.validateRecoveryBackup({ ...backup, access_token: 'synthetic-secret' }));
await no('backup wrong fingerprint rejected', () => recovery.validateRecoveryBackup({ ...backup, source: { ...backup.source, fingerprint: '0'.repeat(64) } }));
await no('backup foreign owner rejected', () => recovery.validateRecoveryBackup({ ...backup, source: { ...backup.source, subjectId: identity(999) } }));
await no('normal Import refuses recovery envelope', () => h.get().importRoutine(btoa(encodeURIComponent(JSON.stringify(backup)))));
check('recovery Import refusal no write', () => assert.equal(h.writes(),1));

for (const method of ['template','reset','import','ai']) {
  const c = harness(); await c.get().fetchRoutine(); let prompt;
  const replacement = () => method === 'reset' ? c.get().resetActiveSplit() : method === 'template' ? c.get().applyTemplate(c.get().templates[0].id) : method === 'import' ? c.get().importRoutine(btoa(encodeURIComponent(JSON.stringify(model.routinePlanToLegacyPlan(h.get().routine))))) : c.get().applyAiRoutine(model.routinePlanToLegacyPlan(h.get().routine));
  c.guard.registerRoutineGuard(async p => { prompt = p; return false; });
  await no(`${method} cancel`, replacement);
  check(`${method} confirmation bound to original backup`, () => assert(prompt.kind === 'recovery-replace' && prompt.source === c.get().sourceSnapshot));
  check(`${method} cancel zero write/exact source`, () => assert(c.writes() === 0 && c.get().readGraph && !c.get().replacementPending && c.get().sourceSnapshot.fingerprint === legacy.source.fingerprint));
  c.guard.registerRoutineGuard(async () => true); await replacement();
  check(`${method} confirmed one RPC and reread`, () => assert.deepEqual([c.writes(),c.get().loadStatus,c.get().isDirty,c.get().readGraph], [1,'ready',false,null]));
}
for (const drift of ['revision','source','subject']) {
  const c = harness(); await c.get().fetchRoutine(); const approval = deferred(); c.guard.registerRoutineGuard(() => approval.promise);
  const pending = c.get().resetActiveSplit(); const rejected = no(`stale ${drift} approval`, () => pending);
  if (drift === 'revision') c.store.setState({ draftRevision: c.get().draftRevision + 1 });
  if (drift === 'source') c.store.setState({ sourceSnapshot: { ...c.get().sourceSnapshot, fingerprint: '0'.repeat(64) } });
  if (drift === 'subject') c.subject(identity(999));
  approval.resolve(true); await rejected;
  check(`${drift} drift no write`, () => assert.equal(c.writes(),0));
}
const driftRows = structuredClone(rows); driftRows.exercises[0].target_reps = '11';
const remote = harness({ read: ({ fetches, generation }) => result(fetches > 1 ? driftRows : rows, generation) }); await remote.get().fetchRoutine(); remote.guard.registerRoutineGuard(async () => true);
await no('remote source drift before replacement', () => remote.get().resetActiveSplit());
check('remote source drift zero write/source preserved', () => assert(remote.writes() === 0 && remote.get().sourceSnapshot.fingerprint === legacy.source.fingerprint));
let submitted;
const latch = deferred(), duplicate = harness({ save: plan => { submitted = plan; return latch.promise; } }); await duplicate.get().fetchRoutine(); duplicate.guard.registerRoutineGuard(async () => true);
const p1 = duplicate.get().resetActiveSplit(), p2 = duplicate.get().resetActiveSplit();
while (!duplicate.writes()) await new Promise(resolve => setImmediate(resolve));
const joinedSave = duplicate.get().saveRoutineToDb();
check('duplicate replacement one write', () => assert.equal(duplicate.writes(),1));
latch.resolve(submitted); await p1; await p2; await joinedSave;
check('duplicate success verified once', () => assert.equal(duplicate.get().loadStatus,'ready'));
const unverified = harness({ read: ({ generation }) => result(rows,generation) }); await unverified.get().fetchRoutine(); unverified.guard.registerRoutineGuard(async () => true);
await no('replacement mismatched readback', () => unverified.get().resetActiveSplit());
check('accepted but unverified replacement requires Reload, not another Save', () => assert.equal(unverified.get().loadStatus,'error'));
await no('accepted unverified cannot repeat write', () => unverified.get().saveRoutineToDb());
check('repeat blocked no second write', () => assert.equal(unverified.writes(),1));
const unverifiedSave = harness({read:({generation}) => result(rows,generation)}); await unverifiedSave.get().fetchRoutine(); fix(unverifiedSave);
await no('accepted recovery Save failed verification',()=>unverifiedSave.get().saveRoutineToDb());
await no('accepted recovery Save cannot write twice',()=>unverifiedSave.get().saveRoutineToDb());
check('unverified Save retains backup evidence only',()=>assert.equal(unverifiedSave.writes()===1 && unverifiedSave.get().loadStatus==='error' && compat.routineCapabilities(unverifiedSave.get()).canBackup,true));
let latePlan;
const lateWrite=deferred(), late=harness({save:plan=>{latePlan=plan;return lateWrite.promise;}}); await late.get().fetchRoutine(); late.guard.registerRoutineGuard(async()=>true);
const lateFlight=late.get().resetActiveSplit();
while(!late.writes()) await new Promise(resolve=>setImmediate(resolve));
const preSwitchFetches=late.fetches(); late.subject(identity(999)); lateWrite.resolve(latePlan);
await no('late replacement from old subject rejected',()=>lateFlight);
check('late old-subject result makes no new-owner read/install',()=>assert.deepEqual([late.fetches(),late.get().loadStatus,late.get().routine,late.get().readGraph],[preSwitchFetches,'idle',null,null]));
const fail = harness({ save: async () => { throw new Error('Synthetic network failure'); } }); await fail.get().fetchRoutine(); fail.guard.registerRoutineGuard(async () => true);
await no('replacement transport failure', () => fail.get().resetActiveSplit());
check('failed replacement original preserved and retry available', () => assert.deepEqual([fail.get().readGraph,fail.get().sourceSnapshot.fingerprint,compat.routineCapabilities(fail.get()).canReset], [legacy.routine,legacy.source.fingerprint,true]));

const tooMany = rowsFromRoutine(h.get().routine);
const item = tooMany.exercises[0]; tooMany.exercises = tooMany.exercises.filter(ex => ex.routine_day_id !== item.routine_day_id);
for (let i = 0; i < 201; i++) tooMany.exercises.push({ ...item, id: identity(2000 + i), order_index:i });
const large = await result(tooMany), largeStore = harness({ initial:large }); await largeStore.get().fetchRoutine();
check('201 historical rows preserved recoverable', () => assert.equal(large.routine.days[0].exercises.length,201));
check('capacity issue/Add blocked', () => assert(large.issues.some(issue => issue.code === 'write_capacity_exceeded') && !compat.routineCapabilities(largeStore.get()).canAddExercise));
await no('201 cannot promote/write', async () => compat.promoteRoutineForWrite(large.routine));
const atLimit = structuredClone(h.get().routine), day = atLimit.days[0]; day.exercises = Array.from({length:200},(_,i)=>({...day.exercises[0],id:identity(3000+i),order:i}));
const editor = load('src/lib/routine-editor.ts');
await no('new Add at 200 blocked', async () => editor.addOccurrence(atLimit, day.id, day.exercises[0]));
check('capacity Add does not truncate baseline', () => assert.equal(day.exercises.length,200));
const fatal = harness({ initial:{status:'fatal',source:null,error:{kind:'graph',code:'weekday_graph',message:'Synthetic fatal'}} }); await fatal.get().fetchRoutine();
check('fatal no default/destructive replacement/backup', () => { const c = compat.routineCapabilities(fatal.get()); assert.deepEqual([fatal.get().routine,c.canReset,c.canApplyTemplate,c.canBackup,c.canStartWorkout],[null,false,false,false,false]); });
await no('fatal reset handler fails closed', () => fatal.get().resetActiveSplit());

// Render the actual notice and shared Hybrid recovery fields with synthetic IO.
function render(h, file, name, props = {}) {
  const noop=()=>{}, settings={defaultRestTimer:90}, workout={isActive:false,isSummaryDismissed:true,exercises:[],startWorkout:noop};
  const local = localTypeScriptLoader({ '@/store/useRoutineStore': { useRoutineStore: Object.assign(selector => selector ? selector(h.get()) : h.get(), { getState:h.get }) }, '@/components/RoutineDraftGuard': { RoutineGuardedLink: props => React.createElement('a', props) },
    'next/navigation':{useRouter:()=>({push:noop}),usePathname:()=>'/routines'},'next/link':{__esModule:true,default:props=>React.createElement('a',props)},
    '@/store/useWorkoutStore':{useWorkoutStore:()=>workout},'@/store/useSettingsStore':{useSettingsStore:selector=>selector?selector(settings):settings},
    '@/store/useProfileStore':{useProfileStore:()=>({profile:null,fetchProfile:noop})},'@/store/useFriendsStore':{useFriendsStore:()=>({friends:[],fetchFriends:noop})},
    '@/store/useRecoveryStore':{useRecoveryStore:()=>({muscles:[],readinessScore:100})},'@/store/useNotificationStore':{useNotificationStore:()=>({unreadCount:0,fetchNotifications:noop,initRealtime:noop})},
    '@/hooks/useWeather':{useWeather:()=>({status:'error',icon:'cloud'})},'@/lib/supabase':{supabase:{}},'@/components/Orb':{__esModule:true,default:()=>null},
    './Orb':{__esModule:true,default:()=>null},
  });
  return renderToStaticMarkup(React.createElement(local(file)[name],props));
}
const ui = harness(); await ui.get().fetchRoutine();
for (const context of [{},{workout:true},{editor:true}]) check('actual recovery notice actionable', () => { const html=render(ui,'src/components/routine-editor/RoutineStateNotice.tsx','RoutineStateNotice',context); assert(html.includes(context.workout?'Fix your routine before':'Routine needs attention') && html.includes('Private Recovery Backup') && !html.includes('Loading plan')); });
check('fatal notice actionable/no reset', () => { const html=render(fatal,'src/components/routine-editor/RoutineStateNotice.tsx','RoutineStateNotice'); assert(html.includes('Retry')&&!html.includes('Replace Routine')); });
const entry = ui.get().readGraph.days[0].exercises[2];
check('shared occurrence editor explicit placeholder/no default', () => { const html=render(ui,'src/components/routine-editor/RoutineOccurrenceEditor.tsx','RoutineOccurrenceEditor',{occurrence:entry,expanded:true,canMoveUp:false,canMoveDown:false,isSaving:false,defaultRest:60,onMove(){},onRemove(){}}); assert(html.includes('Choose unit') && html.includes('Stored load unit') && html.includes('unitless') && html.includes('aria-invalid="true"') && html.includes('Done closes this card')); });
check('resolution classification not generic raw controls', () => assert.equal(recovery.recoveryIssueHandling([{...legacy.issues[0],code:'invalid_zone'}]),'replacement'));
for(const [file,expected] of [['src/app/page.tsx','Routine needs attention'],['src/app/routines/page.tsx','Push Pull Legs (6-Day)'],['src/app/workout/page.tsx','Fix your routine before starting a workout'],['src/app/routines/templates/page.tsx','Explore'],['src/app/routines/edit/page.tsx','Lateral Raises']]) check(`actual ${file} recovery rendering`,()=>{const html=render(ui,file,'default');assert(html.includes(expected)&&!html.includes('Loading plan...')&&!html.includes('Select Workout Day'));});
for(const file of ['src/app/page.tsx','src/app/routines/page.tsx','src/app/workout/page.tsx','src/app/routines/edit/page.tsx']) check(`actual ${file} fatal rendering`,()=>assert(render(fatal,file,'default').includes('Unable to load routine')));
console.log(`Routine recovery validation passed: ${positive} positive assertions, ${negative} negative fixtures.`);
console.log('Actual capabilities, store, confirmation bridge, private backups, strict promotion/save/reread and shared UI rendered. Synthetic IO only; no network/database/Production writes.');
