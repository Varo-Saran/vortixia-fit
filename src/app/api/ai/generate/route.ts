import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { generateRoutine, GoalType, SplitType } from '@/lib/ixia-ai';

export async function POST(req: Request) {
  try {
    let session = null;
    let supabase = null;
    try {
      supabase = await createSupabaseServer();
      const { data } = await supabase.auth.getSession();
      session = data?.session;
    } catch (e) {
      console.warn('Supabase initialization or session fetch skipped/failed:', e);
    }

    const userId = session?.user?.id;
    const body = await req.json();
    const { goal: selectedGoal, split = 'ppl' } = body;

    // Fetch user metrics including goal
    let metrics = null;
    if (supabase && userId) {
      const { data: metricsData, error: metricsErr } = await supabase
        .from('user_metrics')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (metricsErr) {
        console.error('Error fetching metrics:', metricsErr);
      }
      metrics = metricsData ?? null;
    }

    // Prioritize metric's goal if the prompt meant that literally, else fallback to selected goal
    const userGoal = (metrics?.goal || selectedGoal || 'hypertrophy') as GoalType;
    const userSplit = (split || 'ppl') as SplitType;

    // Generate local routine using the built-in deterministic algorithm
    const rawRoutine = generateRoutine(userGoal, userSplit);

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const shortDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    let distribution: string[] = [];
    if (userSplit === 'bro_split') {
      distribution = ['Chest', 'Back', 'Arms', 'Shoulders', 'Legs', 'Rest', 'Rest'];
    } else if (userSplit === 'ppl') {
      distribution = ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest'];
    } else if (userSplit === 'upper_lower') {
      distribution = ['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest'];
    } else if (userSplit === 'full_body') {
      distribution = ['FullBody', 'Rest', 'FullBody', 'Rest', 'FullBody', 'Rest', 'Rest'];
    }

    const parsedPlan = daysOfWeek.map((dayName, index) => {
      const dayType = distribution[index] || 'Rest';
      const mainLifts = rawRoutine[dayName] || [];
      
      return {
        day: dayName,
        shortDay: shortDays[index],
        type: dayType,
        title: dayType === 'Rest' ? 'Active Recovery' : `${dayType} Day`,
        warmups: [],
        mainLifts: mainLifts
      };
    });

    return NextResponse.json({ plan: parsedPlan });
  } catch (error: any) {
    console.error('Error generating AI routine:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
