// Entirely synthetic identities/timestamps. No Production accounts or rows.
export const owner = '00000000-0000-4000-8000-000000000001';
const stamp = '2020-01-01T00:00:00.000Z';
export const identity = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export function rowsFromRoutine(routine) {
  return { routine: { id: routine.id, name: routine.name, user_id: owner, is_active: true, created_at: stamp },
    days: routine.days.map(day => ({ id: day.id, routine_id: routine.id, day_name: day.weekday[0].toUpperCase() + day.weekday.slice(1), short_day: day.weekday[0].toUpperCase(), title: day.title, type: day.kind, created_at: stamp })),
    exercises: routine.days.flatMap(day => day.exercises.map(item => ({ id: item.id, routine_day_id: day.id, exercise_id: item.exerciseId,
      name: item.name, type: item.targetMuscle, is_warmup: item.section === 'warmup', order_index: item.order,
      target_sets: item.targetSets, target_reps: item.targetValue, tracking_style: item.trackingType, weight_unit: item.weightUnit,
      cardio_zone: item.cardioZone, rest_seconds: item.restSeconds, note: item.note ?? null, created_at: stamp }))) };
}
export function legacyPplRoutine() {
  let occurrence = 100;
  const names = [['Bench Press', 'Shoulder Press', 'Lateral Raises', 'Tricep Extensions'], ['Bent-over Row', 'Lat Pulldown', 'Bicep Curls'], ['Squat', 'Leg Press', 'Leg Extension', 'Leg Curl'], [], [], [], []];
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return { id: identity(2), name: 'Push Pull Legs (6-Day)', days: weekdays.map((weekday, index) => ({ id: identity(index + 10), weekday,
    title: index === 6 ? 'Rest' : `Training ${index + 1}`, kind: index === 6 ? 'rest' : 'training', exercises: names[index].map((name, order) => ({
      id: identity(occurrence++), exerciseId: null, name, targetMuscle: 'Synthetic muscle', section: 'main', order, targetSets: 3,
      targetValue: name === 'Lateral Raises' ? '15' : name === 'Bicep Curls' ? '12' : '10', trackingType: 'reps_weight',
      weightUnit: ['Lateral Raises', 'Bicep Curls'].includes(name) ? 'unitless' : 'kg', cardioZone: null, restSeconds: null,
      note: `Synthetic original note for ${name}.`,
    })) })) };
}
export function embeddedRows(rows) {
  return { ...rows.routine, routine_days: rows.days.map(day => ({ ...day, planned_exercises: rows.exercises.filter(item => item.routine_day_id === day.id) })) };
}
