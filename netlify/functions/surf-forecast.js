const BARLEYCOVE = {
  lat: 51.46716,
  lon: -9.77497,
};

const WINDY_URL = "https://api.windy.com/api/point-forecast/v2";

async function getWindyForecast(model, parameters, apiKey) {
  const response = await fetch(WINDY_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      lat: BARLEYCOVE.lat,
      lon: BARLEYCOVE.lon,
      model,
      parameters,
      levels: ["surface"],
      key: apiKey,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message?.join?.(", ") ||
        data?.error ||
        `Windy API returned ${response.status}.`,
    );
  }

  return data;
}

async function getTideForecast() {
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    time: "time,stationID,Water_Level",
    stationID: "Castletownbere",
    "time>=": start.toISOString(),
    "time<=": end.toISOString(),
  });

  const url =
    "https://erddap.marine.ie/erddap/tabledap/imiTidePrediction.json?" +
    params.toString();

  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Marine Institute tide API returned ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Marine Institute returned invalid JSON: ${text.slice(0, 300)}`,
    );
  }

  if (!data.table || !Array.isArray(data.table.rows)) {
    throw new Error("Marine Institute returned no tide data.");
  }

  const tides = data.table.rows
    .map((row) => ({
      time: new Date(row[0]).getTime(),
      height: Number(row[2]),
    }))
    .filter(
      (tide) => Number.isFinite(tide.time) && Number.isFinite(tide.height),
    )
    .sort((a, b) => a.time - b.time);

  if (tides.length === 0) {
    throw new Error("Marine Institute returned an empty tide forecast.");
  }

  return tides;
}

async function getWaterTemperatureForecast() {
  const params = new URLSearchParams({
    latitude: BARLEYCOVE.lat.toString(),
    longitude: BARLEYCOVE.lon.toString(),
    hourly: "sea_surface_temperature",
    timezone: "GMT",
    forecast_days: "8",
    cell_selection: "sea",
  });

  const url =
    "https://marine-api.open-meteo.com/v1/marine?" + params.toString();

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.reason || `Open-Meteo marine API returned ${response.status}.`,
    );
  }

  if (
    !data.hourly ||
    !Array.isArray(data.hourly.time) ||
    !Array.isArray(data.hourly.sea_surface_temperature)
  ) {
    throw new Error("Open-Meteo returned no sea temperature data.");
  }

  return data.hourly.time
    .map((time, index) => ({
      time: new Date(time).getTime(),
      temperature: Number(data.hourly.sea_surface_temperature[index]),
    }))
    .filter(
      (item) => Number.isFinite(item.time) && Number.isFinite(item.temperature),
    );
}

function alignSeriesToForecast(forecastTimestamps, sourceSeries, valueKey) {
  if (!Array.isArray(sourceSeries) || sourceSeries.length === 0) {
    return forecastTimestamps.map(() => null);
  }

  const sorted = [...sourceSeries].sort((a, b) => a.time - b.time);

  return forecastTimestamps.map((timestamp) => {
    let low = 0;
    let high = sorted.length - 1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);

      if (sorted[middle].time < timestamp) {
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    const after = sorted[Math.min(low, sorted.length - 1)];
    const before = sorted[Math.max(0, low - 1)];

    const beforeDifference = Math.abs(before.time - timestamp);
    const afterDifference = Math.abs(after.time - timestamp);
    const closest = beforeDifference <= afterDifference ? before : after;

    return closest?.[valueKey] ?? null;
  });
}

function mergeForecasts(waveData, windData) {
  const result = {
    ts: waveData.ts,
    units: {
      ...(waveData.units || {}),
      ...(windData.units || {}),
    },
  };

  for (const [key, value] of Object.entries(waveData)) {
    if (key === "ts" || key === "units") {
      continue;
    }

    result[key] = value;
  }

  const windIndexByTimestamp = new Map();

  windData.ts.forEach((timestamp, index) => {
    windIndexByTimestamp.set(timestamp, index);
  });

  for (const [key, value] of Object.entries(windData)) {
    if (key === "ts" || key === "units") {
      continue;
    }

    result[key] = waveData.ts.map((timestamp) => {
      const windIndex = windIndexByTimestamp.get(timestamp);

      if (windIndex === undefined) {
        return null;
      }

      return value[windIndex] ?? null;
    });
  }

  return result;
}

export default async () => {
  const apiKey = Netlify.env.get("WINDY_API_KEY");

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "WINDY_API_KEY is not configured.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const wavePromise = getWindyForecast(
      "iconEuWave",
      ["waves", "wavesPower", "swell1"],
      apiKey,
    );

    const windPromise = getWindyForecast(
      "iconEu",
      ["wind", "windGust", "temp"],
      apiKey,
    );

    const [waveData, windData] = await Promise.all([wavePromise, windPromise]);

    const [tideResult, waterResult] = await Promise.allSettled([
      getTideForecast(),
      getWaterTemperatureForecast(),
    ]);

    const tideData = tideResult.status === "fulfilled" ? tideResult.value : [];

    if (tideResult.status === "rejected") {
      console.error("Tide forecast error:", tideResult.reason);
    }

    const waterData =
      waterResult.status === "fulfilled" ? waterResult.value : [];

    if (waterResult.status === "rejected") {
      console.error("Water temperature forecast error:", waterResult.reason);
    }

    const mergedData = mergeForecasts(waveData, windData);

    mergedData.tides = tideData;
    mergedData.waterTemperature = alignSeriesToForecast(
      mergedData.ts,
      waterData,
      "temperature",
    );

    return new Response(JSON.stringify(mergedData), {
      status: 200,

      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900",
      },
    });
  } catch (error) {
    console.error("Surf forecast error:", error);

    return new Response(
      JSON.stringify({
        error: "Surf forecast request failed.",
        details: error.message,
      }),
      {
        status: 500,

        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
