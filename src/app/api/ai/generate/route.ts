import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { goal: selectedGoal, split } = body;

    // Fetch user metrics including goal
    const { data: metrics, error: metricsErr } = await supabase
      .from('user_metrics')
      .select('*')
      .eq('id', userId)
      .single();

    if (metricsErr && metricsErr.code !== 'PGRST116') {
      console.error('Error fetching metrics:', metricsErr);
    }

    // Prioritize metric's goal if the prompt meant that literally, else fallback to selected goal
    const userGoal = metrics?.goal || selectedGoal || 'hypertrophy';
    
    const prompt = `
You are iXiA, an expert AI fitness coach. 
Generate a 7-day workout routine for a user.

User Metrics: ${JSON.stringify(metrics || {})}
Goal: ${userGoal}
Split: ${split || 'ppl'}

Output EXACTLY a JSON array of 7 objects (Monday through Sunday) matching this TypeScript interface:

type TrackingType = 'reps_weight' | 'time_weight' | 'time_only' | 'cardio_hr' | 'reps_only';
type WeightUnit = 'kg' | 'lbs' | 'plates' | 'unitless';

interface PlannedExercise {
  id: string; // unique short string like "e1", "e2"
  name: string;
  targetMuscle: string;
  trackingType: TrackingType;
  weightUnit: WeightUnit;
  targetSets: number;
  targetValue: string; // e.g., "8-10", "60 secs"
  note?: string;
  isWarmup?: boolean;
}

interface DayPlan {
  day: string; // "Monday", "Tuesday", etc.
  shortDay: string; // "M", "T", "W", "T", "F", "S", "S"
  type: string; // e.g., "Push", "Pull", "Rest"
  title: string; // e.g., "Push Day", "Active Recovery"
  warmups: PlannedExercise[];
  mainLifts: PlannedExercise[];
}

Return ONLY valid JSON.
`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error('Gemini API Error:', errorText);
      return NextResponse.json({ error: 'Failed to generate routine from AI' }, { status: 500 });
    }

    const geminiData = await geminiRes.json();
    const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
    }

    let parsedPlan;
    try {
      parsedPlan = JSON.parse(generatedText);
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON:', generatedText);
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }

    return NextResponse.json({ plan: parsedPlan });
  } catch (error) {
    console.error('Error generating AI routine:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
