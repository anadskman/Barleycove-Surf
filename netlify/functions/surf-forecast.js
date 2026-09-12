const BARLEYCOVE = {
  lat: 51.469,
  lon: -9.777,
};

exports.handler = async () => {
  const apiKey = process.env.WINDY_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "WINDY_API_KEY is not configured.",
      }),
    };
  }

  const requestBody = {
    lat: BARLEYCOVE.lat,
    lon: BARLEYCOVE.lon,

    model: "iconEuWave",

    parameters: ["waves", "windWaves", "swell1", "swell2", "wavesPower"],

    levels: ["surface"],

    key: apiKey,
  };

  try {
    const response = await fetch(
      "https://api.windy.com/api/point-forecast/v2",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(requestBody),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          error: "Windy API request failed.",
          details: data,
        }),
      };
    }

    return {
      statusCode: 200,

      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900",
      },

      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        error: "Could not connect to Windy.",
        details: error.message,
      }),
    };
  }
};