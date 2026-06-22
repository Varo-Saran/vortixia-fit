"use client";

import { useState, useEffect } from "react";

export type WeatherIconType = "sun" | "cloud" | "rain" | "snow" | "storm" | "none";

interface WeatherState {
  temp: number | null;
  condition: string;
  city: string | null;
  status: "loading" | "granted" | "denied" | "error" | "idle";
  icon: WeatherIconType;
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherState>({
    temp: null,
    condition: "--",
    city: null,
    status: "idle",
    icon: "none"
  });

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    const fetchWeather = async (lat: number, lon: number) => {
      try {
        // 1. Get Weather from Open-Meteo
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const weatherData = await weatherRes.json();
        
        // 2. Get City from BigDataCloud (free client-side reverse geocoding)
        const cityRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        const cityData = await cityRes.json();

        const current = weatherData.current_weather;
        const temp = Math.round(current.temperature);
        const code = current.weathercode;
        const city = cityData.city || cityData.locality || cityData.principalSubdivision || "Unknown City";

        // Map WMO Weather Codes to our UI state
        let condition = "Clear";
        let icon: WeatherIconType = "sun";

        if (code === 0) {
          condition = "Clear"; icon = "sun";
        } else if (code >= 1 && code <= 3) {
          condition = "Cloudy"; icon = "cloud";
        } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
          condition = "Raining"; icon = "rain";
        } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
          condition = "Snowing"; icon = "snow";
        } else if (code >= 95 && code <= 99) {
          condition = "Stormy"; icon = "storm";
        } else {
          condition = "Cloudy"; icon = "cloud"; // fallback
        }

        setWeather({
          temp,
          condition,
          city,
          status: "granted",
          icon
        });

      } catch (err) {
        console.error("Failed to fetch weather data", err);
        setWeather(prev => ({ ...prev, status: "error" }));
      }
    };

    setWeather(prev => ({ ...prev, status: "loading" }));

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn("Location permission denied", error);
          setWeather(prev => ({ ...prev, status: "denied" }));
        },
        { timeout: 10000 }
      );
    } else {
      setWeather(prev => ({ ...prev, status: "error" }));
    }

  }, []);

  return weather;
}
