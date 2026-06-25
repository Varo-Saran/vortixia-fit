import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
      return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
    }

    // Try 1: Open-Meteo API
    try {
      const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const response = await fetch(openMeteoUrl, {
        next: { revalidate: 900 } // Cache forecast for 15 minutes
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.current_weather) {
          return NextResponse.json({
            success: true,
            source: 'open-meteo',
            temperature: data.current_weather.temperature,
            weathercode: data.current_weather.weathercode
          });
        }
      }
    } catch (openMeteoErr) {
      console.warn("Open-Meteo fetch failed in server proxy, trying MET Norway fallback:", openMeteoErr);
    }

    // Try 2: MET Norway API (Norwegian Meteorological Institute - highly accurate international fallback)
    try {
      const metNorwayUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
      const response = await fetch(metNorwayUrl, {
        headers: {
          'User-Agent': 'VortixiaFit/1.0 (vathsu@gmail.com)'
        },
        next: { revalidate: 900 }
      });

      if (response.ok) {
        const data = await response.json();
        const instant = data.properties?.timeseries?.[0]?.data?.instant?.details;
        const next1h = data.properties?.timeseries?.[0]?.data?.next_1_hours?.summary?.symbol_code;

        if (instant && next1h) {
          const temperature = instant.air_temperature;
          
          // Map MET Norway symbol_code to WMO weathercode
          let weathercode = 0; // default clear
          if (next1h.includes('clearsky')) weathercode = 0;
          else if (next1h.includes('fair') || next1h.includes('partlycloudy')) weathercode = 1;
          else if (next1h.includes('cloudy')) weathercode = 3;
          else if (next1h.includes('rainshowers') || next1h.includes('lightrain')) weathercode = 51;
          else if (next1h.includes('heavyrain') || next1h.includes('rain')) weathercode = 61;
          else if (next1h.includes('snow')) weathercode = 71;
          else if (next1h.includes('thunder')) weathercode = 95;

          return NextResponse.json({
            success: true,
            source: 'met-norway',
            temperature,
            weathercode
          });
        }
      }
    } catch (metNorwayErr) {
      console.error("MET Norway fallback failed:", metNorwayErr);
    }

    return NextResponse.json({ error: 'All weather APIs failed' }, { status: 502 });

  } catch (error: any) {
    console.error("Unexpected error in weather API route:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
