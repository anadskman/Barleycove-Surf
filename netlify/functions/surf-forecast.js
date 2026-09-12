const BARLEYCOVE = {
  lat: 51.469,
  lon: -9.777,
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

function mergeForecasts(waveData, windData) {
  const result = {
    ts: waveData.ts,
    units: {
      ...(waveData.units || {}),
      ...(windData.units || {}),
    },
  };

  /*
   * Add all wave/swell data.
   */

  for (const [key, value] of Object.entries(waveData)) {
    if (key === "ts" || key === "units") {
      continue;
    }

    result[key] = value;
  }

  /*
   * Match wind data to the wave timestamps.
   */

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
    /*
     * ICON-EU wave model.
     *
     * iconEuWave supports:
     * waves
     * wavesPower
     * swell1
     */

    const wavePromise = getWindyForecast(
      "iconEuWave",
      ["waves", "wavesPower", "swell1"],
      apiKey,
    );

    /*
     * ICON-EU weather model.
     *
     * This provides the local wind vectors.
     */

    const windPromise = getWindyForecast(
      "iconEu",
      ["wind", "windGust"],
      apiKey,
    );

    const [waveData, windData] = await Promise.all([wavePromise, windPromise]);

    const mergedData = mergeForecasts(waveData, windData);

    return new Response(JSON.stringify(mergedData), {
      status: 200,

      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900",
      },
    });
  } catch (error) {
    console.error("Windy forecast error:", error);

    return new Response(
      JSON.stringify({
        error: "Windy API request failed.",
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
