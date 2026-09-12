const installButton = document.getElementById("installButton");

const hourlyGrid = document.getElementById("hourlyGrid");

const ratingLabel = document.getElementById("ratingLabel");
const ratingReason = document.getElementById("ratingReason");
const scoreValue = document.getElementById("scoreValue");

const swellHeight = document.getElementById("swellHeight");
const swellDetails = document.getElementById("swellDetails");

const windSpeed = document.getElementById("windSpeed");
const windDetails = document.getElementById("windDetails");

const tideState = document.getElementById("tideState");
const tideDetails = document.getElementById("tideDetails");

const waterTemp = document.getElementById("waterTemp");
const waterDetails = document.getElementById("waterDetails");

let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();

  deferredInstallPrompt = event;

  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();

  await deferredInstallPrompt.userChoice;

  deferredInstallPrompt = null;

  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;

  installButton.hidden = true;
});

function degreesToCompass(degrees) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  const index = Math.round(degrees / 45) % 8;

  return directions[index];
}

function metresPerSecondToKnots(speed) {
  return speed * 1.94384;
}

function getValue(data, key, index) {
  if (!data[key]) {
    return null;
  }

  const value = data[key][index];

  if (value === null || value === undefined) {
    return null;
  }

  return value;
}

async function loadForecast() {
  ratingLabel.textContent = "Loading forecast";
  ratingReason.textContent = "Getting the latest Barleycove conditions...";
  scoreValue.textContent = "--";

  try {
    const response = await fetch("/.netlify/functions/surf-forecast");

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Forecast request failed.");
    }

    displayCurrentConditions(data);
  } catch (error) {
    console.error("Forecast error:", error);

    ratingLabel.textContent = "Forecast unavailable";
    ratingReason.textContent =
      "We could not load the latest forecast. Check the API connection.";
    scoreValue.textContent = "--";
  }
}

function displayCurrentConditions(data) {
  if (!data.ts || data.ts.length === 0) {
    throw new Error("Windy returned no forecast timestamps.");
  }

  const now = Date.now();

  let closestIndex = 0;
  let smallestDifference = Infinity;

  for (let i = 0; i < data.ts.length; i++) {
    const difference = Math.abs(data.ts[i] - now);

    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestIndex = i;
    }
  }

  displayHourlyForecast(data);

  const swellHeightValue = getValue(
    data,
    "swell1_height-surface",
    closestIndex,
  );

  const swellPeriodValue = getValue(
    data,
    "swell1_period-surface",
    closestIndex,
  );

  const swellDirectionValue = getValue(
    data,
    "swell1_direction-surface",
    closestIndex,
  );

  if (swellHeightValue !== null) {
    swellHeight.textContent = `${swellHeightValue.toFixed(1)} m`;
  } else {
    swellHeight.textContent = "--";
  }

  if (swellPeriodValue !== null && swellDirectionValue !== null) {
    swellDetails.textContent = `${swellPeriodValue.toFixed(0)}s · ${degreesToCompass(swellDirectionValue)}`;
  } else {
    swellDetails.textContent = "--";
  }

  const windU = getValue(data, "wind_u-surface", closestIndex);

  const windV = getValue(data, "wind_v-surface", closestIndex);

  if (windU !== null && windV !== null) {
    const windSpeedMs = Math.sqrt(windU * windU + windV * windV);

    const windSpeedKnots = metresPerSecondToKnots(windSpeedMs);

    let windDirection = (Math.atan2(windU, windV) * 180) / Math.PI;

    if (windDirection < 0) {
      windDirection += 360;
    }

    windSpeed.textContent = `${windSpeedKnots.toFixed(0)} kt`;

    windDetails.textContent = degreesToCompass(windDirection);
  } else {
    windSpeed.textContent = "--";
    windDetails.textContent = "--";
  }

  tideState.textContent = "Coming soon";
  tideDetails.textContent = "Tide API in Step 5";

  waterTemp.textContent = "Coming soon";
  waterDetails.textContent = "Water temperature in Step 5";

  const score = calculateTemporaryScore(
    swellHeightValue,
    swellPeriodValue,
    swellDirectionValue,
    windU,
    windV,
  );

  scoreValue.textContent = score;

  if (score >= 70) {
    ratingLabel.textContent = "Worth going";
    ratingReason.textContent =
      "The forecast currently has a promising combination of swell and wind.";
  } else if (score >= 45) {
    ratingLabel.textContent = "Maybe";
    ratingReason.textContent =
      "There is some surf showing, but the conditions are not especially convincing.";
  } else {
    ratingLabel.textContent = "Probably not";
    ratingReason.textContent =
      "The current forecast does not look particularly promising.";
  }
}

function calculateTemporaryScore(height, period, direction, windU, windV) {
  if (height === null || period === null || direction === null) {
    return "--";
  }

  let score = 0;

  if (height >= 1.0) {
    score += 25;
  } else if (height >= 0.7) {
    score += 18;
  } else if (height >= 0.4) {
    score += 10;
  }

  if (period >= 12) {
    score += 25;
  } else if (period >= 10) {
    score += 20;
  } else if (period >= 8) {
    score += 13;
  } else if (period >= 6) {
    score += 7;
  }

  if (direction >= 190 && direction <= 240) {
    score += 30;
  } else if (direction >= 170 && direction <= 260) {
    score += 20;
  } else {
    score += 5;
  }

  if (windU !== null && windV !== null) {
    const windSpeedMs = Math.sqrt(windU * windU + windV * windV);

    const windSpeedKnots = metresPerSecondToKnots(windSpeedMs);

    if (windSpeedKnots <= 10) {
      score += 20;
    } else if (windSpeedKnots <= 15) {
      score += 13;
    } else if (windSpeedKnots <= 20) {
      score += 6;
    }
  }

  return Math.min(100, Math.round(score));
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

loadForecast();

function formatForecastTime(timestamp, index) {
  const date = new Date(timestamp);

  if (index === 0) {
    return "Now";
  }

  return date.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getWindConditions(data, index) {
  const windU = getValue(data, "wind_u-surface", index);

  const windV = getValue(data, "wind_v-surface", index);

  if (windU === null || windV === null) {
    return null;
  }

  const speedMs = Math.sqrt(windU * windU + windV * windV);

  const speedKnots = metresPerSecondToKnots(speedMs);

  let direction = (Math.atan2(windU, windV) * 180) / Math.PI;

  if (direction < 0) {
    direction += 360;
  }

  return {
    speed: speedKnots,
    direction: degreesToCompass(direction),
  };
}

function displayHourlyForecast(data) {
  if (!data.ts || data.ts.length === 0) {
    hourlyGrid.innerHTML = "<p>Hourly forecast unavailable.</p>";

    return;
  }

  const now = Date.now();

  let currentIndex = 0;
  let smallestDifference = Infinity;

  for (let i = 0; i < data.ts.length; i++) {
    const difference = Math.abs(data.ts[i] - now);

    if (difference < smallestDifference) {
      smallestDifference = difference;
      currentIndex = i;
    }
  }

  const hoursToShow = 12;

  const endIndex = Math.min(currentIndex + hoursToShow, data.ts.length);

  let html = "";

  for (let index = currentIndex; index < endIndex; index++) {
    const swellHeight = getValue(data, "swell1_height-surface", index);

    const swellPeriod = getValue(data, "swell1_period-surface", index);

    const swellDirection = getValue(data, "swell1_direction-surface", index);

    const wind = getWindConditions(data, index);

    const timeLabel = formatForecastTime(data.ts[index], index - currentIndex);

    const swellHeightText =
      swellHeight !== null ? `${swellHeight.toFixed(1)} m` : "--";

    let swellDetailsText = "--";

    if (swellPeriod !== null && swellDirection !== null) {
      swellDetailsText =
        `${swellPeriod.toFixed(0)}s · ` + `${degreesToCompass(swellDirection)}`;
    }

    const windSpeedText = wind !== null ? `${wind.speed.toFixed(0)} kt` : "--";

    const windDetailsText = wind !== null ? wind.direction : "--";

    const isCurrent = index === currentIndex;

    html += `
      <article class="hourly-card${isCurrent ? " current" : ""}">
        <div class="hourly-time">
          ${timeLabel}
        </div>

        <div class="hourly-swell">
          <div class="hourly-swell-height">
            ${swellHeightText}
          </div>

          <div class="hourly-swell-details">
            ${swellDetailsText}
          </div>
        </div>

        <div class="hourly-wind">
          <div class="hourly-wind-speed">
            ${windSpeedText}
          </div>

          <div class="hourly-wind-details">
            Wind ${windDetailsText}
          </div>
        </div>
      </article>
    `;
  }

  hourlyGrid.innerHTML = html;
}
