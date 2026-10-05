import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { disposablePostgres } from './lib/disposable-postgres.mjs';
import { localTypeScriptLoader } from './lib/load-local-typescript.mjs';

const migrationPath = 'supabase/migrations/20260930222114_add_cardio_zone_to_planned_exercises.sql';
const migration = await readFile(migrationPath, 'utf8');
const foundation = await readFile('supabase/migrations/20260929052108_routine_data_model_foundation.sql', 'utf8');
const fixture = await readFile('scripts/fixtures/cardio-zone-staging.sql', 'utf8');
const load = localTypeScriptLoader();
const model = load('src/lib/routine-model.ts');
const templates = load('src/lib/routine-templates.ts');
const catalog = load('src/lib/exercise-catalog.ts');
const cardio = load('src/lib/routine-cardio-presentation.ts');
const programming = load('src/lib/routine-programming.ts');
const owner = randomUUID();
const otherOwner = randomUUID();
const matrixOwner = randomUUID();
const graph = templates.materializeRoutineTemplate(templates.getBuiltInRoutineTemplate('tpl_int_ppl_5'));
const otherGraph = templates.materializeRoutineTemplate(templates.getBuiltInRoutineTemplate('tpl_bro_5'));
// Frozen pre-D2D-B serializer, deliberately independent of the current serializer.
// No cardioZone key: retain old-client compatibility during rolling deployment.
function oldClientPayload(routine) {
  const prepared = model.prepareRoutinePlanForSave(routine);
  return { id: prepared.id, name: prepared.name, days: prepared.days.map(day => ({
    id: day.id, weekday: day.weekday, title: day.title, kind: day.kind,
    exercises: day.exercises.map(e => ({ id: e.id, exercise_id: e.exerciseId, name: e.name,
      target_muscle: e.targetMuscle, section: e.section, order: e.order,
      target_sets: e.targetSets, target_value: e.targetValue, tracking_type: e.trackingType,
      weight_unit: e.weightUnit, rest_seconds: e.restSeconds, note: e.note ?? null })),
  })) };
}
const oldPayload = oldClientPayload(graph);
const otherPayload = oldClientPayload(otherGraph);
const matrixCases = [
  { exerciseId: '9003', note: 'Zone 1', trackingType: 'cardio_hr', expected: 1 },
  { exerciseId: '9003', note: 'Zone 2', trackingType: 'time_weight', weightUnit: 'kg', restSeconds: 75, expected: 2 },
  { exerciseId: '9003', note: 'Zone 5', restSeconds: 120, expected: 5 },
  { exerciseId: '9003', note: 'Easy aerobic work', trackingType: 'reps_only', expected: null },
  { exerciseId: '9003', note: 'Zone 1 ... Zone 2', expected: null },
  { exerciseId: '9008', note: 'Zone 2', expected: null },
  { exerciseId: '3666', note: undefined, targetValue: 'Zone 4', trackingType: 'reps_weight', weightUnit: 'lbs', restSeconds: 3600, expected: 4 },
  { exerciseId: '2141', note: 'zOnE 3', trackingType: 'reps_weight', weightUnit: 'plates', restSeconds: 1, expected: 3 },
];
const matrixGraph = {
  id: randomUUID(), name: 'Synthetic backfill matrix',
  days: model.WEEKDAYS.map((weekday, dayIndex) => ({
    id: randomUUID(), weekday, title: dayIndex === 0 ? 'Synthetic programming' : 'Full Rest',
    kind: dayIndex === 0 ? 'training' : 'rest',
    exercises: dayIndex === 0 ? matrixCases.map((test, order) => {
      const resolved = catalog.getExerciseById(test.exerciseId);
      return { id: randomUUID(), exerciseId: test.exerciseId, name: resolved.displayName,
        targetMuscle: resolved.primaryMuscle, section: 'main', order, targetSets: 1,
        targetValue: test.targetValue ?? '30 mins', trackingType: test.trackingType ?? 'time_only', weightUnit: test.weightUnit ?? 'unitless',
        restSeconds: test.restSeconds ?? null, cardioZone: null, ...(test.note === undefined ? {} : { note: test.note }) };
    }) : [],
  })),
};
const matrixPayload = oldClientPayload(matrixGraph);
const cardioId = graph.days[0].exercises.at(-1).id;
const strengthId = graph.days[0].exercises[3].id;
let assertions = 0;
let negatives = 0;
function eq(actual, expected, message) { assertions++; assert.deepEqual(actual, expected, message); }
function ok(value, message) { assertions++; assert.ok(value, message); }
const literal = (value) => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;
const clone = (value) => structuredClone(value);

async function reject(callback, code, message) {
  negatives++;
  await assert.rejects(async () => { await callback(); }, (error) => error.code === code, message);
}

// Adapter portability: preserve strict matching for both sync and async failures.
const expectedRejection = Object.assign(new Error('Synthetic expected rejection'), { code: '23514' });
await reject(() => { throw expectedRejection; }, '23514', 'Capture a synchronous adapter throw');
ok(true, 'Synchronous rejection is captured');
await reject(() => Promise.reject(expectedRejection), '23514', 'Capture a Promise adapter rejection');
ok(true, 'Asynchronous rejection is captured');
await assert.rejects(() => reject(() => {}, '23514', 'Unexpected success must fail'),
  { code: 'ERR_ASSERTION' });
ok(true, 'An unexpectedly successful call still fails the rejection assertion');
const wrongRejection = Object.assign(new Error('Synthetic wrong SQLSTATE'), { code: '22023' });
await assert.rejects(() => reject(() => { throw wrongRejection; }, '23514', 'Wrong SQLSTATE must fail'),
  (error) => error.code === 'ERR_ASSERTION' && error.actual === wrongRejection);
ok(true, 'Wrong SQLSTATE remains a failure and preserves the unexpected error');

async function save(db, payload, user = owner) {
  // Real SECURITY DEFINER RPC under authenticated role + synthetic JWT subject.
  await db.exec(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub', ${literal(user)}, true);
    select public.save_active_routine_v1(${json(payload)}); commit;`);
}
async function snapshot(db, excludeZone = false, routineId) {
  const [rootRows, days, exercises] = await Promise.all([
    db.query(`select to_jsonb(r) as row from public.routines r
      ${routineId ? `where id = ${literal(routineId)}::uuid` : ''} order by id`),
    db.query(`select to_jsonb(d) as row from public.routine_days d
      ${routineId ? `where routine_id = ${literal(routineId)}::uuid` : ''} order by id`),
    db.query(`select to_jsonb(e) ${excludeZone ? "- 'cardio_zone'" : ''} as row
      from public.planned_exercises e
      ${routineId ? `where routine_day_id in (select id from public.routine_days where routine_id = ${literal(routineId)}::uuid)` : ''}
      order by id`),
  ]);
  return { roots: rootRows.map((r) => r.row), days: days.map((r) => r.row), exercises: exercises.map((r) => r.row) };
}
async function security(db) {
  return {
    tables: await db.query(`select relname, relrowsecurity, relforcerowsecurity, relacl::text
      from pg_class where oid in ('public.routines'::regclass, 'public.routine_days'::regclass,
      'public.planned_exercises'::regclass) order by relname`),
    policies: await db.query(`select tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies where schemaname='public' order by tablename, policyname`),
    rpc: await db.query(`select proowner::regrole::text as owner, prosecdef, proconfig, proacl::text,
      pg_get_function_identity_arguments(oid) as args, pg_get_function_result(oid) as result
      from pg_proc where oid='public.save_active_routine_v1(jsonb)'::regprocedure`),
  };
}
async function protectedState(db) {
  return db.query(`select (select count(*) from public.users) as users,
    (select count(*) from public.workout_sessions) as sessions,
    (select count(*) from public.workout_sets) as sets,
    (select count(*) from public.workout_completion_operations) as completions,
    (select count(*) from public.xp_events) as xp_events`);
}
async function bootstrap(db) {
  await db.exec(fixture);
  eq((await db.query('select count(*)::integer as count from public.routines'))[0].count, 0,
    'Historical D1 reset runs only in an EMPTY disposable fixture');
  await db.exec(foundation);
  await db.exec(`insert into public.users values (${literal(owner)}::uuid), (${literal(otherOwner)}::uuid), (${literal(matrixOwner)}::uuid)`);
  await save(db, oldPayload);
  await save(db, otherPayload, otherOwner);
  await save(db, matrixPayload, matrixOwner);
}
async function zone(db, id = cardioId) {
  return (await db.query(`select cardio_zone from public.planned_exercises where id=${literal(id)}::uuid`))[0].cardio_zone;
}
function payloadWith({ id = cardioId, note, target, exerciseId, value, absent = true } = {}) {
  const payload = clone(oldPayload);
  const occurrence = payload.days.flatMap((d) => d.exercises).find((e) => e.id === id);
  if (note !== undefined) occurrence.note = note;
  if (target !== undefined) occurrence.target_value = target;
  if (exerciseId !== undefined) occurrence.exercise_id = exerciseId;
  if (!absent) occurrence.cardioZone = value;
  return payload;
}
async function extract(db, id, target, note) {
  return (await db.query(`select public.routine_legacy_cardio_zone_v1(
    ${literal(id)}, ${literal(target)}, ${literal(note)}) as zone`))[0].zone;
}

const reviewedIds = ['9001', '9003', '3666', '2141'];
// Supplemental scope check only; the tests below execute the SQL itself.
const rpcDefinition = (sql) => sql.match(/create or replace function public\.save_active_routine_v1[\s\S]*?\$function\$;/i)[0];
const withoutZoneAdditions = rpcDefinition(migration)
  .replace('  v_cardio_zone smallint;\n', '')
  .replace(/\n      -- JSONB key presence[\s\S]*?\n      v_seen_occurrence_ids :=/, '\n      v_seen_occurrence_ids :=')
  .replace(/\n      v_cardio_zone := case[\s\S]*?\n      insert into public\.planned_exercises \(/, '\n      insert into public.planned_exercises (')
  .replace('        cardio_zone,\n', '')
  .replace('        v_cardio_zone,\n', '');
const nonblankLines = (sql) => sql.split(/\r?\n/).filter((line) => line.trim()).join('\n');
eq(nonblankLines(withoutZoneAdditions), nonblankLines(rpcDefinition(foundation)),
  'RPC differs from reviewed D1 implementation ONLY by Zone validation/persistence');
for (const id of reviewedIds) {
  ok(cardio.isCatalogCardio(catalog.getExerciseById(id)), `Reviewed ID ${id} is canonical cardio`);
  ok(migration.includes(`'${id}'`), `Reviewed ID ${id} exists in migration allowlist`);
}
eq(graph.days.length, 7, 'Synthetic Intermediate graph has seven days');
eq(graph.days.flatMap((d) => d.exercises).length, 64, 'Synthetic Intermediate graph has 64 occurrences');
eq(graph.days.flatMap((d) => d.exercises).filter((e) => e.section === 'warmup').length, 11, '11 warmups');
ok(oldPayload.days.every((d) => d.exercises.every((e) => !Object.hasOwn(e, 'cardioZone'))),
  'Old-client fixture has NO cardioZone key');
const currentPayload = JSON.parse(JSON.stringify(model.routinePlanToRpcPayload(graph)));
ok(currentPayload.days.every(day => day.exercises.every(exercise => Object.hasOwn(exercise, 'cardioZone'))), 'D2D-B JSON ALWAYS contains cardioZone');
ok(currentPayload.days.flatMap(day => day.exercises).some(exercise => exercise.cardioZone === null), 'Explicit null is retained in JSON');
for (const value of [1, 2, 3, 4, 5]) {
  const current = clone(graph); current.days[0].exercises.at(-1).cardioZone = value;
  eq(JSON.parse(JSON.stringify(model.routinePlanToRpcPayload(current))).days[0].exercises.at(-1).cardioZone, value, 'New client exact structured JSON value');
}

const db = await disposablePostgres();
try {
  console.log(`Staging: ${db.engine}; ${(await db.query("select current_setting('server_version') as version"))[0].version}`);
  await bootstrap(db);
  const before = await snapshot(db);
  const securityBefore = await security(db);
  const protectedBefore = await protectedState(db);
  const otherBefore = await snapshot(db, false, otherGraph.id);
  const started = performance.now();
  await db.exec(migration);
  console.log(`Actual migration execution: ${(performance.now() - started).toFixed(1)} ms`);
  eq(await snapshot(db, true), before, 'Migration preserves EVERY pre-existing row field, identity and timestamp');
  eq(await snapshot(db, true, otherGraph.id), otherBefore, 'Other synthetic owner graph remains unchanged');
  eq(await security(db), securityBefore, 'All ownership RLS, table grants and RPC ACL/signature/security unchanged');
  eq(await protectedState(db), protectedBefore, 'Migration does not touch protected sentinel tables');

  const column = (await db.query(`select data_type, is_nullable, column_default from information_schema.columns
    where table_schema='public' and table_name='planned_exercises' and column_name='cardio_zone'`))[0];
  eq(column, { data_type: 'smallint', is_nullable: 'YES', column_default: null }, 'Nullable smallint, no non-NULL default');
  const seededRows = (await snapshot(db)).exercises;
  eq([...new Set(seededRows.map((e) => e.tracking_style))].sort(), [...model.TRACKING_TYPES].sort(), 'All five tracking modes preserved');
  eq([...new Set(seededRows.map((e) => e.weight_unit))].sort(), [...model.WEIGHT_UNITS].sort(), 'All four exact routine units preserved');
  eq(seededRows.find((e) => e.id === matrixGraph.days[0].exercises[1].id).rest_seconds, 75,
    'Arbitrary existing rest override remains exact through migration');
  const expectedBackfill = graph.days.flatMap((d) => d.exercises)
    .filter((e) => reviewedIds.includes(e.exerciseId) && cardio.explicitHeartRateZone(e.targetValue, e.note));
  eq(expectedBackfill.length, 10, 'Curated Intermediate legacy inventory has 10 explicit Zone occurrences');
  eq(seededRows.filter((e) => e.cardio_zone !== null).length, 15, 'Exactly 15 synthetic rows backfilled (10 Intermediate + 5 matrix)');
  for (const [index, test] of matrixCases.entries()) {
    eq(await zone(db, matrixGraph.days[0].exercises[index].id), test.expected,
      'Actual migration backfill covers Zone 1/2/5, no Zone, conflict, non-cardio and target text');
  }
  console.log('Synthetic backfill: 15 qualifying / 15 updated / 1 conflicting row left NULL');
  for (const row of seededRows) {
    const original = before.exercises.find((e) => e.id === row.id);
    eq(row.note, original.note, 'Backfill leaves note verbatim');
    eq(row.cardio_zone, reviewedIds.includes(row.exercise_id)
      ? cardio.explicitHeartRateZone(row.target_reps, row.note) : null, 'Backfill matches reviewed exact programming');
  }

  // Real helper execution: exact tokens, conflicts and no broad inference.
  for (const id of reviewedIds) {
    for (let value = 1; value <= 5; value++) {
      eq(await extract(db, id, `Zone ${value}`, null), value, 'Target explicit Zone supported');
      eq(await extract(db, id, '30 mins', `Zone ${value}. Programming.`), value, 'Note explicit Zone supported');
      eq(programming.legacyCardioZone(id, `Zone ${value}`, `Zone ${value}. Programming.`), value, 'Client normalization mirrors reviewed SQL exact tokens');
    }
  }
  eq(await extract(db, '9003', '30 mins', 'zOnE 2.'), 2, 'Case insensitive');
  eq(await extract(db, '9003', 'Zone 2', 'Zone 2'), 2, 'Repeated identical token remains unambiguous');
  eq(await extract(db, '9003', 'Zone 1', 'Zone 2'), null, 'Conflicting source fields do not choose one');
  eq(await extract(db, '9003', 'Zone', '2'), null, 'Never synthesize a token across separate target/note fields');
  const ignoredTexts = ['easy recovery aerobic tempo threshold hard heart rate RPE 2', 'Zone 0', 'Zone 6',
    'Zone 20', 'Zone 02', 'Zone 2.5', 'Zone 2-3', 'Zone 2–3', 'Zone 2/3', 'Zone 2 to 3',
    'ozone 2', 'Zone2', 'Zone 2a', 'Zone 1 ... Zone 2', 'Zone 6 ... Zone 2', 'Zone 2-3 ... Zone 4'];
  for (const text of ignoredTexts) eq(await extract(db, '9003', '30 mins', text), null, `Ignore unsupported/ambiguous text: ${text}`);
  for (const text of ignoredTexts) eq(programming.legacyCardioZone('9003', '30 mins', text), null, `Client strictly ignores the same legacy token: ${text}`);
  for (const text of ['ézone 2', 'Zone 2é', 'ZONE\t4', 'Zone 2. Notes unchanged.', 'Zone 3 ... Zone 3']) {
    eq(programming.legacyCardioZone('9003', '', text), await extract(db, '9003', '', text), 'Client/SQL whole-word and whitespace semantics match');
  }
  for (const id of ['9008', 'vx_ex_bodyweight_side_plank', 'vx_ex_intermediate_hip_flexor_quad_stretch', null, 'unknown', 'Stationary Bike']) {
    eq(await extract(db, id, 'Zone 2', 'Zone 2'), null, 'Non-reviewed identity cannot infer cardio Zone');
  }

  // Old clients really save through the new function using actual current payloads.
  await save(db, oldPayload);
  eq(await zone(db), 2, 'Old-client Zone 2 survives ordinary save after backfill');
  for (const value of [1, 2, 5]) {
    await save(db, payloadWith({ note: `Zone ${value}. Synthetic programming.` }));
    eq(await zone(db), value, 'Old payload fallback roundtrips Zone');
  }
  for (const note of ['Easy aerobic work.', 'Zone 1 ... Zone 2']) {
    await save(db, payloadWith({ note }));
    eq(await zone(db), null, 'Old payload without unambiguous token persists NULL');
  }
  await save(db, payloadWith({ id: strengthId, note: 'Zone 2' }));
  eq(await zone(db, strengthId), null, 'Non-cardio Zone note cannot backfill through old RPC');
  await save(db, payloadWith({ target: 'Zone 5', note: null }));
  eq(await zone(db), 5, 'Legacy target text is an approved source');

  // Future typed value/null wins without rewriting legacy text.
  for (const value of [1, 2, 3, 4, 5, null]) {
    const note = 'Zone 2. Aerobic base building.';
    await save(db, payloadWith({ note, value, absent: false }));
    const row = (await db.query(`select cardio_zone, note from public.planned_exercises where id=${literal(cardioId)}::uuid`))[0];
    eq(row.cardio_zone, value, 'Future value/null roundtrip from DB');
    eq(row.note, note, 'Structured value never edits legacy note');
  }
  eq(await zone(db), null, 'Explicit NULL suppresses existing Zone 2 note fallback');
  await save(db, payloadWith({ value: 2, note: 'Zone 1', absent: false }));
  eq(await zone(db), 2, 'Structured Zone 2 takes precedence over note Zone 1');
  await save(db, payloadWith({ value: 4, note: 'Zone 2. Aerobic base building.', absent: false }));
  eq(await zone(db), 4, 'Structured Zone 4 takes precedence over note Zone 2');

  // Invalid scalar/types: validation must precede writes and never clamp/coerce.
  for (const value of [0, 6, -1, 1.5, 2.9, '2', '', true, false, {}, [], [2], 1e10]) {
    const stable = await snapshot(db);
    await reject(() => save(db, payloadWith({ value, absent: false })), '22023', 'Reject invalid future Zone');
    await db.exec('rollback;');
    eq(await snapshot(db), stable, 'Rejected Zone leaves entire graph unchanged');
  }
  for (const value of [0, 6]) {
    await reject(() => db.exec(`update public.planned_exercises set cardio_zone=${value} where id=${literal(cardioId)}::uuid`),
      '23514', 'Column range CHECK rejects out-of-domain values');
  }
  await db.exec(`update public.planned_exercises set cardio_zone=null where id=${literal(cardioId)}::uuid`);
  eq(await zone(db), null, 'Column accepts NULL');
  for (const value of [1, 2, 3, 4, 5]) {
    await db.exec(`update public.planned_exercises set cardio_zone=${value} where id=${literal(cardioId)}::uuid`);
    eq(await zone(db), value, 'Column accepts each valid Zone');
  }

  // Browser grants remain SELECT-only even for the additive column/helper.
  for (const role of ['anon', 'authenticated']) {
    for (const table of ['routines', 'routine_days', 'planned_exercises']) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        eq((await db.query(`select has_table_privilege(${literal(role)}, ${literal(`public.${table}`)}, ${literal(privilege)}) as allowed`))[0].allowed,
          false, 'No direct table DML broadened');
      }
    }
    eq((await db.query(`select has_function_privilege(${literal(role)},
      'public.routine_legacy_cardio_zone_v1(text,text,text)', 'EXECUTE') as allowed`))[0].allowed, false, 'Helper is not a client API');
  }
  eq((await db.query("select has_function_privilege('anon','public.save_active_routine_v1(jsonb)','EXECUTE') as allowed"))[0].allowed,
    false, 'Anonymous save denied');
  eq((await db.query("select has_function_privilege('authenticated','public.save_active_routine_v1(jsonb)','EXECUTE') as allowed"))[0].allowed,
    true, 'Authenticated RPC boundary retained');
  await reject(() => db.exec(`begin; set local role authenticated;
    update public.planned_exercises set cardio_zone=2 where id=${literal(cardioId)}::uuid; commit;`), '42501', 'Actual browser direct update denied');
  await db.exec('rollback;');
  await reject(() => save(db, otherPayload), '23505', 'Actual cross-owner root overwrite denied');
  await db.exec('rollback;');
  const collidingDay = clone(oldPayload);
  collidingDay.days[0].id = otherPayload.days[0].id;
  await reject(() => save(db, collidingDay), '23505', 'Actual cross-owner day collision denied');
  await db.exec('rollback;');
  const collidingOccurrence = clone(oldPayload);
  collidingOccurrence.days[0].exercises[0].id = otherPayload.days[0].exercises[0].id;
  await reject(() => save(db, collidingOccurrence), '23505', 'Actual cross-owner occurrence collision denied');
  await db.exec('rollback;');
  await reject(() => db.exec(`begin; set local role anon;
    select public.save_active_routine_v1(${json(oldPayload)}); commit;`), '42501', 'Actual anonymous RPC call denied');
  await db.exec('rollback;');
  await reject(() => save(db, oldPayload, ''), '42501', 'Missing authenticated subject denied');
  await db.exec('rollback;');
  const hidden = await db.query(`select count(*)::integer as count from public.planned_exercises`);
  eq((await db.query('select count(*)::integer as count from public.planned_exercises',
    { role: 'authenticated', user: owner }))[0].count, 64, 'RLS exposes only authenticated owner graph');
  eq(hidden[0].count, 77, 'All three synthetic owners exist for isolation test');
  eq(await snapshot(db, false, otherGraph.id), { ...otherBefore, exercises: otherBefore.exercises.map((e) => ({ ...e, cardio_zone: null })) },
    'Other owner remains unchanged after all own-user saves');
  eq(await protectedState(db), protectedBefore, 'All save tests leave protected tables unchanged');

  // Preserve stable IDs and programming on an ordinary old-client save/reload.
  await save(db, oldPayload);
  const final = await snapshot(db, false, graph.id);
  eq(final.roots.map((r) => r.id), [graph.id], 'Stable root survives');
  eq(final.days.map((d) => d.id).sort(), graph.days.map((d) => d.id).sort(), 'Stable day IDs survive');
  eq(final.exercises.map((e) => e.id).sort(), graph.days.flatMap((d) => d.exercises.map((e) => e.id)).sort(), 'All 64 occurrence IDs survive');
  const dayRows = final.days;
  const exerciseRows = final.exercises;
  eq(model.routinePlanFromRows({ routine: final.roots[0], days: dayRows, exercises: exerciseRows }),
    model.prepareRoutinePlanForSave(graph), 'CURRENT client reload mapping still works with additive DB column');

  // Exercise rollback after RPC has begun child replacement, not just preflight.
  const stable = await snapshot(db);
  await db.exec(`create function public.synthetic_insert_failure() returns trigger language plpgsql as $fail$
    begin raise exception 'SYNTHETIC_INSERT_FAILURE'; end; $fail$;
    create trigger synthetic_insert_failure before insert on public.planned_exercises
    for each row execute function public.synthetic_insert_failure();`);
  await reject(() => save(db, oldPayload), 'P0001', 'Late RPC failure is surfaced');
  await db.exec('rollback;');
  eq(await snapshot(db), stable, 'Late insert failure restores root and complete child graph');
  await db.exec('drop trigger synthetic_insert_failure on public.planned_exercises; drop function public.synthetic_insert_failure();');
} finally {
  await db.close();
}

// Inject a failure AFTER each migration stage in separate disposable databases.
// Execute the actual migration transaction; no textual assertion can substitute.
for (const boundary of ['-- Internal compatibility helper', '-- Update only the new column',
  '-- CREATE OR REPLACE retains', '\ncommit;']) {
  const stage = await disposablePostgres();
  try {
    await bootstrap(stage);
    const before = await snapshot(stage);
    const aclBefore = await security(stage);
    const functionBefore = await stage.query("select pg_get_functiondef('public.save_active_routine_v1(jsonb)'::regprocedure) as definition");
    await reject(() => stage.exec(migration.replace(boundary, `select 1/0;\n${boundary}`)), '22012', 'Injected migration failure surfaces');
    await stage.exec('rollback;');
    eq(await snapshot(stage), before, 'Failed migration retains original graph byte-for-byte');
    eq(await security(stage), aclBefore, 'Failed migration preserves security');
    eq(await stage.query("select pg_get_functiondef('public.save_active_routine_v1(jsonb)'::regprocedure) as definition"),
      functionBefore, 'Failed migration restores original RPC definition');
    eq((await stage.query(`select count(*)::integer as count from information_schema.columns
      where table_schema='public' and table_name='planned_exercises' and column_name='cardio_zone'`))[0].count,
      0, 'No partially added column after rollback');
    eq((await stage.query("select to_regprocedure('public.routine_legacy_cardio_zone_v1(text,text,text)') as helper"))[0].helper,
      null, 'No partially installed helper after rollback');
  } finally { await stage.close(); }
}

console.log(`Cardio Zone foundation: PASS — ${assertions} positive assertions / ${negatives} negative fixtures`);
console.log('Actual PostgreSQL migration/RPC/backfill/RLS/rollback tested. No remote or Production connection.');
