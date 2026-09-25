import type { ExerciseDiscoveryTier, ResolvedExercise } from "@/types/exercise-catalog";

const FIELD_SCORES = {
  displayName: { exact: 1_000, phrase: 750, token: 550, prefix: 420 },
  alias: { exact: 900, phrase: 700, token: 500, prefix: 380 },
  canonicalName: { exact: 760, phrase: 360, token: 300, prefix: 220 },
  primaryMuscle: { exact: 420, phrase: 300, token: 260, prefix: 180 },
  bodyPart: { exact: 400, phrase: 280, token: 240, prefix: 170 },
  equipment: { exact: 380, phrase: 260, token: 220, prefix: 160 },
  secondaryMuscle: { exact: 220, phrase: 150, token: 120, prefix: 80 },
} as const;

const DISCOVERY_TIER_BOOST: Record<ExerciseDiscoveryTier, number> = {
  priority: 60,
  advanced: 20,
  extended: 0,
  hidden: -10_000,
};

const TOKEN_EXPANSIONS: Readonly<Record<string, readonly string[]>> = {
  db: ["dumbbell"],
  bb: ["barbell"],
  rdl: ["romanian", "deadlift"],
  ohp: ["overhead", "press"],
  ezbar: ["ez", "bar"],
  pulldown: ["pull", "down"],
  pullup: ["pull", "up"],
  pushup: ["push", "up"],
  pushdown: ["push", "down"],
  bodyweight: ["body", "weight"],
  ytw: ["y", "t", "w"],
};

const TOKEN_EQUIVALENTS: Readonly<Record<string, string>> = {
  abs: "core",
  biceps: "bicep",
  calves: "calf",
  cardiovascular: "cardio",
  delts: "delt",
  glutes: "glute",
  hamstrings: "hamstring",
  lats: "lat",
  pectorals: "chest",
  quadriceps: "quad",
  quads: "quad",
  shoulders: "shoulder",
  triceps: "tricep",
};

const CONTROLLED_QUERY_EXPANSIONS: Readonly<Record<string, readonly string[]>> = {
  "chest supported row": ["incline row"],
  "rear delt": ["reverse fly"],
};

const BROAD_QUERY_PREFERRED_IDS: Readonly<Record<string, readonly string[]>> = {
  lat: ["0198", "0579", "0652", "1326", "0238", "0197"],
  back: ["0027", "0293", "0861", "1350", "0198", "0579", "0652", "0489"],
  row: ["0027", "0293", "0861", "1350", "0581", "0606"],
  chest: ["0025", "0289", "0577", "0576", "0662", "0251", "0188", "0308"],
  "machine chest": ["0577", "1299", "1300", "0596", "0576"],
  fly: ["0308", "0188", "0596", "0227", "0319"],
  bench: ["0025", "0289", "0047", "0314", "0033", "0301"],
  dip: ["0251", "0814", "0009", "0019", "1399"],
  curl: ["0294", "0031", "0447", "0313", "0070", "0868"],
  tricep: ["0200", "0201", "0241", "1722", "0607", "0814"],
  quad: ["0585", "0739", "0043", "0042", "1760", "bulgarian_split_squats"],
  hamstring: ["0599", "0586", "0582", "0085", "0044"],
  glute: ["9004", "9012", "1409", "9006", "9013", "3645"],
  calf: ["1373", "0605", "0594", "0088", "1379", "0417"],
  core: ["9008", "0274", "0472", "0276", "0979", "0687"],
  cardio: ["9001", "9002", "9003", "2141", "2311", "vx_ex_rowing_machine"],
  bike: ["9003"],
  "reverse fly": ["0602", "0225", "0383", "0154"],
};

type SearchField = keyof typeof FIELD_SCORES;

interface NormalizedSearchValue {
  phrase: string;
  tokens: ReadonlySet<string>;
  lexicalTokens: readonly string[];
}

interface SearchFieldValue extends NormalizedSearchValue {
  field: SearchField;
}

export interface ExerciseSearchDocument {
  exercise: ResolvedExercise;
  fields: readonly SearchFieldValue[];
  normalizedBodyPart: string;
  stableName: string;
}

export interface ExerciseSearchIndex {
  documents: readonly ExerciseSearchDocument[];
  documentsById: ReadonlyMap<string, ExerciseSearchDocument>;
}

export interface ExerciseSearchOptions {
  category?: string;
  limit?: number;
}

export interface ExerciseSearchResult {
  exercise: ResolvedExercise;
  score: number;
}

function normalizeBase(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/'/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeToken(token: string): string {
  return TOKEN_EQUIVALENTS[token] ?? token;
}

function expandToken(token: string): readonly string[] {
  const expanded = TOKEN_EXPANSIONS[token] ?? [token];
  return expanded.map(normalizeToken);
}

export function normalizeExerciseSearchText(value: string): string {
  const base = normalizeBase(value);
  if (!base) return "";

  return base
    .split(" ")
    .flatMap(expandToken)
    .join(" ");
}

function createNormalizedValue(value: string): NormalizedSearchValue {
  const base = normalizeBase(value);
  const lexicalTokens = base
    ? base.split(" ").map(normalizeToken)
    : [];
  const phrase = normalizeExerciseSearchText(value);

  return {
    phrase,
    tokens: new Set(phrase ? phrase.split(" ") : []),
    lexicalTokens,
  };
}

function createField(field: SearchField, value: string): SearchFieldValue {
  return { field, ...createNormalizedValue(value) };
}

function compareStableNames(
  left: ExerciseSearchDocument,
  right: ExerciseSearchDocument,
): number {
  return left.stableName.localeCompare(right.stableName, "en", {
    sensitivity: "base",
  }) || left.exercise.id.localeCompare(right.exercise.id);
}

function compareEmptyQuery(
  left: ExerciseSearchDocument,
  right: ExerciseSearchDocument,
): number {
  const tierDifference =
    DISCOVERY_TIER_BOOST[right.exercise.discoveryTier]
    - DISCOVERY_TIER_BOOST[left.exercise.discoveryTier];

  return tierDifference || compareStableNames(left, right);
}

export function createExerciseSearchIndex(
  exercises: readonly ResolvedExercise[],
): ExerciseSearchIndex {
  const documents = exercises
    .filter(
      (exercise) =>
        !exercise.deprecatedForDiscovery
        && exercise.discoveryTier !== "hidden",
    )
    .map((exercise): ExerciseSearchDocument => {
      const fields: SearchFieldValue[] = [
        createField("displayName", exercise.displayName),
        ...exercise.aliases.map((alias) => createField("alias", alias)),
        createField("canonicalName", exercise.name),
        createField("primaryMuscle", exercise.primaryMuscle),
        createField("bodyPart", exercise.bodyPart),
        createField("equipment", exercise.normalizedEquipment),
        ...exercise.secondaryMuscles.map((muscle) =>
          createField("secondaryMuscle", muscle),
        ),
      ];

      return Object.freeze({
        exercise,
        fields: Object.freeze(fields),
        normalizedBodyPart: normalizeExerciseSearchText(exercise.bodyPart),
        stableName: normalizeExerciseSearchText(exercise.displayName),
      });
    });

  return Object.freeze({
    documents: Object.freeze(documents),
    documentsById: new Map(
      documents.map((document) => [document.exercise.id, document]),
    ),
  });
}

function phraseScore(
  queryPhrase: string,
  fieldValue: SearchFieldValue,
): number {
  if (!queryPhrase || !fieldValue.phrase) return 0;
  const weights = FIELD_SCORES[fieldValue.field];

  if (fieldValue.phrase === queryPhrase) return weights.exact;
  if (
    fieldValue.phrase.startsWith(`${queryPhrase} `)
    || fieldValue.phrase.endsWith(` ${queryPhrase}`)
    || fieldValue.phrase.includes(` ${queryPhrase} `)
  ) {
    return weights.phrase;
  }

  return 0;
}

function tokenScore(
  queryToken: string,
  fieldValue: SearchFieldValue,
): number {
  const weights = FIELD_SCORES[fieldValue.field];
  if (fieldValue.tokens.has(queryToken)) return weights.token;

  if (
    queryToken.length >= 4
    && [...fieldValue.tokens, ...fieldValue.lexicalTokens].some(
      (token) => token.startsWith(queryToken),
    )
  ) {
    return weights.prefix;
  }

  return 0;
}

function hasToken(document: ExerciseSearchDocument, token: string): boolean {
  return document.fields.some((field) => field.tokens.has(token));
}

function broadIntentAdjustment(
  queryPhrase: string,
  document: ExerciseSearchDocument,
): number {
  const primary = normalizeExerciseSearchText(document.exercise.primaryMuscle);
  const bodyPart = normalizeExerciseSearchText(document.exercise.bodyPart);
  const preferredIds = BROAD_QUERY_PREFERRED_IDS[queryPhrase];
  const preferredIndex = preferredIds?.indexOf(document.exercise.id) ?? -1;
  const preferredBoost = preferredIndex >= 0
    ? Math.max(600, 1_200 - preferredIndex * 90)
    : 0;

  if (queryPhrase === "back") {
    const isDirectBackExercise =
      bodyPart.includes("back")
      || primary.includes("upper back")
      || primary.includes("lat")
      || primary.includes("spine");
    if (!isDirectBackExercise) return preferredBoost - 700;
  }

  if (queryPhrase === "curl") {
    if (primary.includes("bicep")) return preferredBoost + 240;
    if (primary.includes("hamstring")) return -80;
    if (primary.includes("forearm")) return -100;
  }

  if (queryPhrase === "row") {
    if (primary.includes("upper back") || primary.includes("lat")) {
      return preferredBoost + 220;
    }
    if (primary.includes("delt") || bodyPart.includes("shoulder")) return -80;
  }

  if (queryPhrase === "fly") {
    if (primary.includes("chest") || bodyPart.includes("chest")) {
      return preferredBoost + 120;
    }
    if (primary.includes("delt") || bodyPart.includes("shoulder")) return -40;
  }

  if (queryPhrase === "bench") {
    if (
      (primary.includes("chest") || bodyPart.includes("chest"))
      && hasToken(document, "press")
    ) {
      return preferredBoost + 160;
    }
    if (primary.includes("tricep")) return -40;
  }

  return preferredBoost;
}

function scoreDocument(
  query: NormalizedSearchValue,
  document: ExerciseSearchDocument,
): number | undefined {
  const queryTokens = [...query.tokens];
  let tokenTotal = 0;

  for (const queryToken of queryTokens) {
    let bestTokenScore = 0;
    for (const fieldValue of document.fields) {
      bestTokenScore = Math.max(
        bestTokenScore,
        tokenScore(queryToken, fieldValue),
      );
    }
    if (bestTokenScore === 0) return undefined;
    tokenTotal += bestTokenScore;
  }

  let bestPhraseScore = 0;
  for (const fieldValue of document.fields) {
    bestPhraseScore = Math.max(
      bestPhraseScore,
      phraseScore(query.phrase, fieldValue),
    );
  }

  const tierBoost = DISCOVERY_TIER_BOOST[document.exercise.discoveryTier];
  const approvalBoost = document.exercise.approval === "green"
    ? 15
    : document.exercise.approval === "yellow"
      ? 8
      : 0;

  return tokenTotal
    + bestPhraseScore
    + tierBoost
    + approvalBoost
    + broadIntentAdjustment(query.phrase, document);
}

function classifyPressGroup(
  document: ExerciseSearchDocument,
): "chest" | "shoulder" | "leg" | "other" {
  const { exercise } = document;
  const primary = normalizeExerciseSearchText(exercise.primaryMuscle);
  const bodyPart = normalizeExerciseSearchText(exercise.bodyPart);

  if (primary.includes("chest") || bodyPart.includes("chest")) return "chest";
  if (primary.includes("delt") || bodyPart.includes("shoulder")) return "shoulder";
  if (
    document.stableName.includes("leg press")
    || bodyPart.includes("upper legs")
    || primary.includes("quad")
    || primary.includes("glute")
  ) {
    return "leg";
  }
  return "other";
}

function diversifyBarePress(
  results: readonly ExerciseSearchResult[],
  documentsById: ReadonlyMap<string, ExerciseSearchDocument>,
): ExerciseSearchResult[] {
  const groups = {
    chest: [] as ExerciseSearchResult[],
    shoulder: [] as ExerciseSearchResult[],
    leg: [] as ExerciseSearchResult[],
    other: [] as ExerciseSearchResult[],
  };

  for (const result of results) {
    const document = documentsById.get(result.exercise.id);
    groups[document ? classifyPressGroup(document) : "other"].push(result);
  }

  const diversified: ExerciseSearchResult[] = [];
  const maximumGroupLength = Math.max(
    groups.chest.length,
    groups.shoulder.length,
    groups.leg.length,
  );

  for (let index = 0; index < maximumGroupLength; index += 1) {
    for (const group of [groups.chest, groups.shoulder, groups.leg]) {
      if (group[index]) diversified.push(group[index]);
    }
  }

  diversified.push(...groups.other);
  return diversified;
}

export function searchExerciseIndex(
  index: ExerciseSearchIndex,
  queryText: string,
  options: ExerciseSearchOptions = {},
): readonly ExerciseSearchResult[] {
  const { category, limit = 50 } = options;
  const normalizedCategory = category
    ? normalizeExerciseSearchText(category)
    : undefined;
  const candidates = index.documents.filter(
    (document) =>
      !normalizedCategory || document.normalizedBodyPart === normalizedCategory,
  );
  const query = createNormalizedValue(queryText);

  if (!query.phrase) {
    return candidates
      .slice()
      .sort(compareEmptyQuery)
      .slice(0, Math.max(0, limit))
      .map(({ exercise }) => ({ exercise, score: 0 }));
  }

  const queryVariants = [
    query,
    ...(CONTROLLED_QUERY_EXPANSIONS[query.phrase] ?? []).map(
      createNormalizedValue,
    ),
  ];
  const scored = candidates.flatMap((document) => {
    let bestScore: number | undefined;
    queryVariants.forEach((queryVariant, index) => {
      const variantScore = scoreDocument(queryVariant, document);
      if (variantScore !== undefined) {
        const adjustedScore = variantScore - (index === 0 ? 0 : 80);
        bestScore = Math.max(bestScore ?? Number.NEGATIVE_INFINITY, adjustedScore);
      }
    });
    return bestScore === undefined
      ? []
      : [{ exercise: document.exercise, score: bestScore }];
  });

  scored.sort((left, right) => {
    const scoreDifference = right.score - left.score;
    if (scoreDifference) return scoreDifference;
    const leftDocument = index.documentsById.get(left.exercise.id);
    const rightDocument = index.documentsById.get(right.exercise.id);
    if (!leftDocument || !rightDocument) {
      return left.exercise.id.localeCompare(right.exercise.id);
    }
    return compareStableNames(leftDocument, rightDocument);
  });

  const ordered = query.phrase === "press"
    ? diversifyBarePress(
        scored,
        index.documentsById,
      )
    : scored;

  return ordered.slice(0, Math.max(0, limit));
}
