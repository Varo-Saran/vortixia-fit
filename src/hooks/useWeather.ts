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

    const fetchWeather = async (lat: number, lon: number, providedCity?: string | null) => {
      try {
        // 1. Get Weather from our local proxy API
        const weatherRes = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
        if (!weatherRes.ok) throw new Error("Weather request failed");
        const weatherData = await weatherRes.json();
        
        // 2. Get City (use IP resolved city if provided, otherwise fallback to reverse-geocoder)
        let city = providedCity || null;
        if (!city) {
          try {
            const cityRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            if (cityRes.ok) {
              const cityData = await cityRes.json();
              city = cityData.city || cityData.locality || cityData.principalSubdivision || null;
            }
          } catch (e) {
            console.warn("Reverse geocoding failed, falling back to coordinates");
          }
        }

        if (!city) {
          city = "My Location";
        }

        if (!weatherData.success) throw new Error("Weather proxy returned success=false");
        const temp = Math.round(weatherData.temperature);
        const code = weatherData.weathercode;

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

    const fetchIPFallback = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) throw new Error("ipapi fallback request failed");
        const data = await res.json();
        if (data.latitude && data.longitude) {
          await fetchWeather(data.latitude, data.longitude, data.city);
        } else {
          setWeather(prev => ({ ...prev, status: "denied" }));
        }
      } catch (err) {
        console.error("IP fallback geocoding failed:", err);
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
          console.warn("Location permission denied, trying IP fallback...", error);
          fetchIPFallback();
        },
        { timeout: 8000 } // slightly lower timeout to trigger IP fallback faster
      );
    } else {
      fetchIPFallback();
    }

  }, []);

  return weather;
}
