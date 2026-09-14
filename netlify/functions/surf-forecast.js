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
  const url =
    "https://erddap.marine.ie/erddap/tabledap/imiTidePrediction.json" +
    "?time,stationID,Water_Level" +
    "&stationID=Castletownbere" +
    "&time>=now-1day" +
    "&time<=now+3days";

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

  if (!data.table || !data.table.rows) {
    throw new Error("Marine Institute returned no tide data.");
  }

  return data.table.rows
    .map((row) => ({
      time: new Date(row[0]).getTime(),
      height: Number(row[2]),
    }))
    .filter(
      (tide) => Number.isFinite(tide.time) && Number.isFinite(tide.height),
    );
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

    let tideData = [];

    try {
      tideData = await getTideForecast();
    } catch (error) {
      console.error("Tide forecast error:", error);
    }

    const mergedData = mergeForecasts(waveData, windData);

    mergedData.tides = tideData;

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
