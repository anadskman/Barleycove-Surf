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

function directionDifference(a, b) {
  const difference = Math.abs(a - b);

  return Math.min(difference, 360 - difference);
}

function getTideConditions(data, timestamp) {
  if (!data.tides || data.tides.length === 0) {
    return null;
  }

  const tides = [...data.tides].sort((a, b) => a.time - b.time);

  let closestIndex = 0;

  let smallestDifference = Infinity;

  for (let i = 0; i < tides.length; i++) {
    const difference = Math.abs(tides[i].time - timestamp);

    if (difference < smallestDifference) {
      smallestDifference = difference;

      closestIndex = i;
    }
  }

  const current = tides[closestIndex];

  const previous = tides[Math.max(0, closestIndex - 1)];

  const next = tides[Math.min(tides.length - 1, closestIndex + 1)];

  let state = "Unknown";

  if (next.height > current.height) {
    state = "Rising";
  } else if (next.height < current.height) {
    state = "Falling";
  }

  return {
    state,

    height: current.height,

    previousTide: previous,

    nextTide: next,
  };
}

function formatTideTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function scoreTide(tide) {
  if (!tide) {
    return 0;
  }

  if (tide.state === "Rising") {
    return 10;
  }

  if (tide.state === "Falling") {
    return 6;
  }

  return 8;
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
    direction,
  };
}

/*NOTE!!!
 * SURF SCORING
 *
 * Maximum score: 100
 *
 * Swell direction: 30
 * Swell height:    15
 * Swell period:    20
 * Wind direction:  20
 * Wind speed:       5
 * Tide:            10
 */

/*
 * Swell direction
 *
 * Barleycove likes SW/SSW swell.
 */

function scoreSwellDirection(direction) {
  if (direction === null) {
    return 0;
  }

  const difference = directionDifference(direction, 225);

  if (difference <= 20) {
    return 30;
  }

  if (difference <= 35) {
    return 27;
  }

  if (difference <= 50) {
    return 23;
  }

  if (direction >= 180 && direction <= 270) {
    return 18;
  }

  if (direction >= 160 && direction <= 290) {
    return 10;
  }

  if (direction >= 140 && direction <= 310) {
    return 5;
  }

  return 0;
}

/* NOTE!!!
 * Swell height
 *
 * This is offshore swell height, not the
 * exact height of the breaking wave at the beach.
 */

function scoreSwellHeight(height) {
  if (height === null) {
    return 0;
  }

  if (height >= 0.6 && height <= 1.4) {
    return 15;
  }

  if (height >= 0.4 && height < 0.6) {
    return 12;
  }

  if (height > 1.4 && height <= 1.8) {
    return 14;
  }

  if (height >= 0.3 && height < 0.4) {
    return 8;
  }

  if (height > 1.8 && height <= 2.2) {
    return 9;
  }

  if (height > 2.2 && height <= 2.8) {
    return 5;
  }

  return 0;
}

function scoreSwellPeriod(period) {
  if (period === null) {
    return 0;
  }

  if (period >= 14) {
    return 20;
  }

  if (period >= 12) {
    return 19;
  }

  if (period >= 10) {
    return 17;
  }

  if (period >= 8) {
    return 13;
  }

  if (period >= 7) {
    return 9;
  }

  if (period >= 6) {
    return 5;
  }

  return 2;
}

/* NOTE!!!
 * Wind direction
 *
 * N = 0
 * NE = 45
 * E = 90
 * SE = 135
 * S = 180
 * SW = 225
 * W = 270
 * NW = 315
 */

function scoreWindDirection(direction) {
  if (direction === null) {
    return 0;
  }

  if (direction >= 0 && direction <= 70) {
    return 20;
  }

  if (direction > 70 && direction <= 110) {
    return 14;
  }

  if (direction > 290 && direction < 360) {
    return 10;
  }

  if (direction > 110 && direction <= 140) {
    return 8;
  }

  if (direction > 140 && direction <= 180) {
    return 5;
  }

  if (direction > 180 && direction <= 270) {
    return 2;
  }

  return 6;
}

function scoreWindSpeed(speed) {
  if (speed === null) {
    return 0;
  }

  if (speed <= 5) {
    return 5;
  }

  if (speed <= 8) {
    return 4;
  }

  if (speed <= 12) {
    return 3;
  }

  if (speed <= 16) {
    return 2;
  }

  if (speed <= 20) {
    return 1;
  }

  return 0;
}

function getSurfRating(score) {
  if (score >= 80) {
    return {
      label: "Very good",
      className: "good",
    };
  }

  if (score >= 65) {
    return {
      label: "Worth going",
      className: "good",
    };
  }

  if (score >= 45) {
    return {
      label: "Worth checking",
      className: "okay",
    };
  }

  if (score >= 25) {
    return {
      label: "Probably not",
      className: "poor",
    };
  }

  return {
    label: "Not worth it",
    className: "poor",
  };
}

function getSurfRatingReason(factors, conditions) {
  const reasons = [];

  if (factors.swellDirection >= 27) {
    reasons.push("excellent SW swell");
  } else if (factors.swellDirection >= 18) {
    reasons.push("good SW swell");
  } else if (factors.swellDirection <= 5) {
    reasons.push("poor swell direction");
  }

  if (factors.swellHeight >= 18) {
    reasons.push("good swell size");
  } else if (factors.swellHeight <= 6) {
    reasons.push("small swell");
  }

  if (factors.period >= 19) {
    reasons.push("long-period swell");
  } else if (factors.period <= 5) {
    reasons.push("short-period swell");
  }

  if (factors.windDirection >= 20) {
    reasons.push("offshore N/NE wind");
  } else if (factors.windDirection <= 2) {
    reasons.push("poor wind direction");
  }

  if (factors.windSpeed >= 9) {
    reasons.push("light wind");
  } else if (factors.windSpeed <= 2) {
    reasons.push("strong wind");
  }

  if (reasons.length === 0) {
    return "Mixed conditions.";
  }

  return (
    reasons
      .slice(0, 3)
      .map((reason) => reason.charAt(0).toUpperCase() + reason.slice(1))
      .join(". ") + "."
  );
}

function calculateSurfScore(data, index = 0) {
  const swellHeight = getValue(data, "swell1_height-surface", index);

  const swellPeriod = getValue(data, "swell1_period-surface", index);

  const swellDirection = getValue(data, "swell1_direction-surface", index);

  const wind = getWindConditions(data, index);

  const windSpeed = wind !== null ? wind.speed : null;

  const windDirection = wind !== null ? wind.direction : null;

  const timestamp = data.ts[index];

  const tide = getTideConditions(data, timestamp);

  const factors = {
    swellDirection: scoreSwellDirection(swellDirection),

    swellHeight: scoreSwellHeight(swellHeight),

    period: scoreSwellPeriod(swellPeriod),

    windDirection: scoreWindDirection(windDirection),

    windSpeed: scoreWindSpeed(windSpeed),

    tide: scoreTide(tide),
  };

  const score =
    factors.swellDirection +
    factors.swellHeight +
    factors.period +
    factors.windDirection +
    factors.windSpeed +
    factors.tide;

  const rating = getSurfRating(score);

  return {
    score: Math.round(score),

    rating: rating.label,

    ratingClass: rating.className,

    reason: getSurfRatingReason(factors, {
      swellHeight,
      swellPeriod,
      swellDirection,
      windSpeed,
      windDirection,
    }),

    factors,

    conditions: {
      swellHeight,
      swellPeriod,
      swellDirection,
      windSpeed,
      windDirection,
      tide,
    },
  };
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

  const wind = getWindConditions(data, closestIndex);

  if (wind !== null) {
    windSpeed.textContent = `${wind.speed.toFixed(0)} kt`;

    windDetails.textContent = degreesToCompass(wind.direction);
  } else {
    windSpeed.textContent = "--";

    windDetails.textContent = "--";
  }

  const currentTide = getTideConditions(data, data.ts[closestIndex]);

  if (currentTide) {
    tideState.textContent = currentTide.state;

    tideDetails.textContent =
      `${currentTide.height.toFixed(1)} m · ` + `Predicted level`;
  } else {
    tideState.textContent = "--";

    tideDetails.textContent = "--";
  }

  waterTemp.textContent = "Coming soon";

  waterDetails.textContent = "Water temperature in Step 5";

  const surfScore = calculateSurfScore(data, closestIndex);

  scoreValue.textContent = surfScore.score;

  ratingLabel.textContent = surfScore.rating;

  ratingReason.textContent = surfScore.reason;
}

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

    const hourlyScore = calculateSurfScore(data, index);

    const hourlyTide = getTideConditions(data, data.ts[index]);

    const timeLabel = formatForecastTime(data.ts[index], index - currentIndex);

    const swellHeightText =
      swellHeight !== null ? `${swellHeight.toFixed(1)} m` : "--";

    let swellDetailsText = "--";

    if (swellPeriod !== null && swellDirection !== null) {
      swellDetailsText =
        `${swellPeriod.toFixed(0)}s · ` + `${degreesToCompass(swellDirection)}`;
    }

    const windSpeedText = wind !== null ? `${wind.speed.toFixed(0)} kt` : "--";

    const windDetailsText =
      wind !== null ? degreesToCompass(wind.direction) : "--";

    const isCurrent = index === currentIndex;

    const tideText = hourlyTide ? hourlyTide.state : "--";

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

        <div class="hourly-tide">
          Tide ${tideText}
        </div>

        <div class="hourly-score">
          ${hourlyScore.score}/100
        </div>
      </article>
    `;
  }

  hourlyGrid.innerHTML = html;
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

function initialiseSurfMap() {
  const mapElement = document.getElementById("surfMap");

  if (!mapElement || typeof L === "undefined") {
    return;
  }

  const map = L.map("surfMap").setView([51.469, -9.777], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  L.marker([51.469, -9.777]).addTo(map).bindPopup("Barleycove").openPopup();
}

initialiseSurfMap();

loadForecast();
