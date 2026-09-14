const SUPABASE_URL = "https://uounbdkorblrjvmczmtw.supabase.co";

const SUPABASE_KEY = "sb_publishable_NeqKyEfPTeIX4OyYpMWoMA_41Cly2gR";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const installButton = document.getElementById("installButton");
const hourlyGrid = document.getElementById("hourlyGrid");
const forecastDays = document.getElementById("forecastDays");
const forecastUpdated = document.getElementById("forecastUpdated");

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

const conditionInfo = document.getElementById("conditionInfo");
const conditionInfoTitle = document.getElementById("conditionInfoTitle");
const conditionInfoTime = document.getElementById("conditionInfoTime");

let deferredInstallPrompt = null;
let forecastData = null;
let selectedForecastIndex = 0;
let selectedDayKey = null;
let selectedCondition = "swell";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function showInstallHelp() {
  if (isStandalone()) {
    installButton.hidden = true;
    return;
  }

  installButton.hidden = false;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  showInstallHelp();
});

installButton.addEventListener("click", async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
    return;
  }

  if (isIOS()) {
    alert(
      "On iPhone or iPad, use the Share button in Safari and choose 'Add to Home Screen'.",
    );
    return;
  }

  alert(
    "Open your browser's install or Add to Home Screen option to install Barleycove Surf.",
  );
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

showInstallHelp();

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

  const height = tide.height;

  if (height === null || height === undefined) {
    if (tide.state === "Rising") {
      return 8;
    }

    if (tide.state === "Falling") {
      return 5;
    }

    return 6;
  }

  if (tide.state === "Rising") {
    if (height <= 0.8) {
      return 10;
    }

    if (height <= 1.5) {
      return 9;
    }

    if (height <= 2.5) {
      return 8;
    }

    return 7;
  }

  if (tide.state === "Falling") {
    if (height <= 0.8) {
      return 7;
    }

    if (height <= 1.5) {
      return 6;
    }

    if (height <= 2.5) {
      return 5;
    }

    return 4;
  }

  return 6;
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

/*
 * NOTE!!!
 * SURF SCORING
 *
 * Maximum score: 100
 *
 * Swell direction: 20
 * Swell exposure:  10
 * Swell height:    15
 * Swell period:    20
 * Wind direction:  20
 * Wind speed:       5
 * Tide:             10
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
    return 20;
  }

  if (difference <= 35) {
    return 18;
  }

  if (difference <= 50) {
    return 15;
  }

  if (direction >= 180 && direction <= 270) {
    return 12;
  }

  if (direction >= 160 && direction <= 290) {
    return 7;
  }

  if (direction >= 140 && direction <= 310) {
    return 3;
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

  if (factors.swellHeight >= 14) {
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

  if (factors.windSpeed >= 4) {
    reasons.push("light wind");
  } else if (factors.windSpeed <= 1) {
    reasons.push("strong wind");
  }

  if (factors.swellExposure >= 9) {
    reasons.push("good beach exposure");
  } else if (factors.swellExposure <= 4) {
    reasons.push("limited swell exposure");
  }

  if (factors.tide >= 9) {
    reasons.push("low tide pushing in");
  } else if (factors.tide >= 7) {
    reasons.push("favourable rising tide");
  } else if (factors.tide <= 4) {
    reasons.push("less favourable tide");
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

function getForecastConfidence(data, index) {
  const values = [
    getValue(data, "swell1_height-surface", index),
    getValue(data, "swell1_period-surface", index),
    getValue(data, "swell1_direction-surface", index),
    getWindConditions(data, index),
  ];

  const available = values.filter((value) => value !== null).length;

  if (available >= 4) {
    return "High";
  }

  if (available >= 3) {
    return "Medium";
  }

  return "Low";
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

    swellExposure: scoreSwellExposure(swellDirection),
  };

  const score =
    factors.swellDirection +
    factors.swellExposure +
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

    confidence: getForecastConfidence(data, index),

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

    forecastData = data;

    const now = Date.now();

    selectedForecastIndex = 0;
    let smallestDifference = Infinity;

    for (let i = 0; i < data.ts.length; i++) {
      const difference = Math.abs(data.ts[i] - now);

      if (difference < smallestDifference) {
        smallestDifference = difference;
        selectedForecastIndex = i;
      }
    }

    selectedDayKey = getDayKey(data.ts[selectedForecastIndex]);

    displayForecastDays(data);
    displayCurrentConditions(data, selectedForecastIndex);
    displayHourlyForecast(data, selectedDayKey);
    updateConditionInfo(data, selectedForecastIndex, selectedCondition);
  } catch (error) {
    console.error("Forecast error:", error);

    ratingLabel.textContent = "Forecast unavailable";
    ratingReason.textContent =
      "We could not load the latest forecast. Check the API connection.";
    scoreValue.textContent = "--";
  }
}

function getSwellApproachAngle(swellDirection) {
  if (swellDirection === null) {
    return null;
  }

  const beachFacingDirection = 180;

  return directionDifference(swellDirection, beachFacingDirection);
}

function scoreSwellExposure(swellDirection) {
  const angle = getSwellApproachAngle(swellDirection);

  if (angle === null) {
    return 0;
  }

  if (angle <= 20) {
    return 10;
  }

  if (angle <= 40) {
    return 9;
  }

  if (angle <= 60) {
    return 8;
  }

  if (angle <= 80) {
    return 6;
  }

  if (angle <= 100) {
    return 4;
  }

  return 2;
}

function updateSwellMap(data, index) {
  const mapElement = document.getElementById("surfMap");

  if (!mapElement || typeof L === "undefined" || !data.ts || !data.ts[index]) {
    return;
  }

  const swellDirection = getValue(data, "swell1_direction-surface", index);

  if (swellDirection === null) {
    return;
  }

  const beach = [51.46716, -9.77497];
  const arrowLength = 0.004;
  const directionRadians = (swellDirection * Math.PI) / 180;

  const endPoint = [
    beach[0] + Math.cos(directionRadians) * arrowLength,
    beach[1] + Math.sin(directionRadians) * arrowLength,
  ];

  if (window.swellArrow) {
    window.swellArrow.setLatLngs([endPoint, beach]);
  } else {
    window.swellArrow = L.polyline([endPoint, beach], {
      weight: 5,
      opacity: 0.9,
    }).addTo(window.surfMap);
  }

  if (window.swellArrowHead) {
    window.swellArrowHead.setLatLng(endPoint);
  } else {
    window.swellArrowHead = L.circleMarker(endPoint, {
      radius: 7,
      weight: 2,
      fillOpacity: 1,
    }).addTo(window.surfMap);
  }

  const approachAngle = getSwellApproachAngle(swellDirection);
  const exposureScore = scoreSwellExposure(swellDirection);
  const directionText = degreesToCompass(swellDirection);

  const labelText =
    `Swell ${directionText} · ` +
    `${approachAngle.toFixed(0)}° off beach · ` +
    `${exposureScore}/10 exposure`;

  if (window.swellDirectionLabel) {
    window.swellDirectionLabel.setLatLng(endPoint);
    window.swellDirectionLabel.setContent(labelText);
  } else {
    window.swellDirectionLabel = L.tooltip({
      permanent: true,
      direction: "top",
      offset: [0, -8],
    })
      .setLatLng(endPoint)
      .setContent(labelText)
      .addTo(window.surfMap);
  }
}

function getDayKey(timestamp) {
  const date = new Date(timestamp);

  return [date.getFullYear(), date.getMonth(), date.getDate()].join("-");
}

function formatDayLabel(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();

  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return "Today";
  }

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  ) {
    return "Tomorrow";
  }

  return date.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatForecastDateTime(timestamp) {
  return new Date(timestamp).toLocaleString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function displayForecastDays(data) {
  if (!forecastDays || !data.ts) {
    return;
  }

  const days = [];

  for (const timestamp of data.ts) {
    const key = getDayKey(timestamp);

    if (!days.some((day) => day.key === key)) {
      days.push({
        key,
        timestamp,
      });
    }
  }

  forecastDays.innerHTML = days
    .map((day) => {
      const selected = day.key === selectedDayKey ? " selected" : "";

      return `
        <button class="forecast-day${selected}" type="button" data-day="${day.key}">
          ${formatDayLabel(day.timestamp)}
        </button>
      `;
    })
    .join("");

  forecastDays.querySelectorAll(".forecast-day").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDayKey = button.dataset.day;

      const index = forecastData.ts.findIndex(
        (timestamp) => getDayKey(timestamp) === selectedDayKey,
      );

      if (index === -1) {
        return;
      }

      selectedForecastIndex = index;

      displayForecastDays(forecastData);
      displayCurrentConditions(forecastData, selectedForecastIndex);
      displayHourlyForecast(forecastData, selectedDayKey);
      updateConditionInfo(
        forecastData,
        selectedForecastIndex,
        selectedCondition,
      );
    });
  });
}

function displayCurrentConditions(data, index) {
  if (!data.ts || data.ts.length === 0) {
    throw new Error("Windy returned no forecast timestamps.");
  }

  selectedForecastIndex = index;

  const timestamp = data.ts[index];

  if (forecastUpdated) {
    forecastUpdated.textContent = formatForecastDateTime(timestamp);
  }

  const swellHeightValue = getValue(data, "swell1_height-surface", index);

  const swellPeriodValue = getValue(data, "swell1_period-surface", index);

  const swellDirectionValue = getValue(data, "swell1_direction-surface", index);

  swellHeight.textContent =
    swellHeightValue !== null ? `${swellHeightValue.toFixed(1)} m` : "--";

  swellDetails.textContent =
    swellPeriodValue !== null && swellDirectionValue !== null
      ? `${swellPeriodValue.toFixed(0)}s · ${degreesToCompass(swellDirectionValue)}`
      : "--";

  const wind = getWindConditions(data, index);

  if (wind !== null) {
    windSpeed.textContent = `${wind.speed.toFixed(0)} kt`;
    windDetails.textContent = degreesToCompass(wind.direction);
  } else {
    windSpeed.textContent = "--";
    windDetails.textContent = "--";
  }

  const currentTide = getTideConditions(data, timestamp);

  if (currentTide) {
    tideState.textContent = currentTide.state;
    tideDetails.textContent = `${currentTide.height.toFixed(1)} m · ${formatTideTime(timestamp)}`;
  } else {
    tideState.textContent = "--";
    tideDetails.textContent = "Tide data unavailable";
  }

  const waterTemperature = getValue(data, "waterTemperature", index);

  if (waterTemperature !== null) {
    waterTemp.textContent = `${waterTemperature.toFixed(1)} °C`;
    waterDetails.textContent = "Sea surface temperature · forecast";
  } else {
    waterTemp.textContent = "--";
    waterDetails.textContent = "Water temperature unavailable";
  }

  const surfScore = calculateSurfScore(data, index);

  scoreValue.textContent = surfScore.score;
  ratingLabel.textContent = surfScore.rating;
  ratingReason.textContent = `${surfScore.reason} Forecast confidence: ${surfScore.confidence}.`;

  updateSwellMap(data, index);
  updateSelectedHourlyCard();
  updateConditionInfo(data, index, selectedCondition);

  document.querySelectorAll(".condition-card").forEach((card) => {
    card.classList.toggle(
      "selected",
      card.dataset.condition === selectedCondition,
    );
  });
}

function displayHourlyForecast(data, dayKey) {
  if (!hourlyGrid || !data.ts || data.ts.length === 0) {
    return;
  }

  const indices = data.ts
    .map((timestamp, index) => ({ timestamp, index }))
    .filter((item) => getDayKey(item.timestamp) === dayKey)
    .map((item) => item.index);

  if (indices.length === 0) {
    hourlyGrid.innerHTML = "<p>Forecast unavailable for this day.</p>";
    return;
  }

  hourlyGrid.innerHTML = indices
    .map((index) => {
      const swellHeight = getValue(data, "swell1_height-surface", index);
      const swellPeriod = getValue(data, "swell1_period-surface", index);
      const swellDirection = getValue(data, "swell1_direction-surface", index);
      const wind = getWindConditions(data, index);
      const hourlyScore = calculateSurfScore(data, index);
      const hourlyTide = getTideConditions(data, data.ts[index]);

      const isSelected = index === selectedForecastIndex;
      const isCurrent = Math.abs(data.ts[index] - Date.now()) < 60 * 60 * 1000;

      const swellHeightText =
        swellHeight !== null ? `${swellHeight.toFixed(1)} m` : "--";

      const swellDetailsText =
        swellPeriod !== null && swellDirection !== null
          ? `${swellPeriod.toFixed(0)}s · ${degreesToCompass(swellDirection)}`
          : "--";

      const windSpeedText =
        wind !== null ? `${wind.speed.toFixed(0)} kt` : "--";

      const windDetailsText =
        wind !== null ? degreesToCompass(wind.direction) : "--";

      const tideText = hourlyTide
        ? `${hourlyTide.state} · ${hourlyTide.height.toFixed(1)} m`
        : "Unavailable";

      return `
        <article
          class="hourly-card${isCurrent ? " current" : ""}${isSelected ? " selected" : ""}"
          data-index="${index}"
          tabindex="0"
          role="button"
          aria-label="Select forecast for ${formatForecastDateTime(data.ts[index])}"
        >
          <div class="hourly-time">
            ${new Date(data.ts[index]).toLocaleTimeString("en-IE", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </div>

          <div class="hourly-date">
            ${new Date(data.ts[index]).toLocaleDateString("en-IE", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </div>

          <div class="hourly-swell">
            <div class="hourly-swell-height">${swellHeightText}</div>
            <div class="hourly-swell-details">${swellDetailsText}</div>
          </div>

          <div class="hourly-wind">
            <div class="hourly-wind-speed">${windSpeedText}</div>
            <div class="hourly-wind-details">Wind ${windDetailsText}</div>
          </div>

          <div class="hourly-tide">Tide ${tideText}</div>

          <div class="hourly-score">${hourlyScore.score}/100</div>
        </article>
      `;
    })
    .join("");

  hourlyGrid.querySelectorAll(".hourly-card").forEach((card) => {
    const select = () => {
      const index = Number(card.dataset.index);

      selectedForecastIndex = index;
      selectedDayKey = getDayKey(data.ts[index]);

      displayForecastDays(data);
      displayCurrentConditions(data, index);
      displayHourlyForecast(data, selectedDayKey);
    };

    card.addEventListener("click", select);

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  });
}

function updateSelectedHourlyCard() {
  if (!hourlyGrid) {
    return;
  }

  hourlyGrid.querySelectorAll(".hourly-card").forEach((card) => {
    card.classList.toggle(
      "selected",
      Number(card.dataset.index) === selectedForecastIndex,
    );
  });
}

function updateConditionInfo(data, index, condition) {
  if (!conditionInfo || !conditionInfoTitle || !conditionInfoTime) {
    return;
  }

  const timestamp = data.ts[index];
  const swellDirection = getValue(data, "swell1_direction-surface", index);
  const swellHeightValue = getValue(data, "swell1_height-surface", index);
  const swellPeriodValue = getValue(data, "swell1_period-surface", index);
  const wind = getWindConditions(data, index);
  const tide = getTideConditions(data, timestamp);
  const score = calculateSurfScore(data, index);

  conditionInfoTitle.textContent =
    condition === "swell"
      ? "Swell"
      : condition === "wind"
        ? "Wind"
        : condition === "tide"
          ? "Tide"
          : "Water";

  conditionInfoTime.textContent = formatForecastDateTime(timestamp);

  if (condition === "swell") {
    const directionText =
      swellDirection !== null ? degreesToCompass(swellDirection) : "--";

    const exposure =
      swellDirection !== null ? scoreSwellExposure(swellDirection) : 0;

    const approach =
      swellDirection !== null ? getSwellApproachAngle(swellDirection) : null;

    conditionInfo.innerHTML = `
      <h3>${swellHeightValue !== null ? swellHeightValue.toFixed(1) + " m" : "--"} swell from ${directionText}</h3>
      <p>
        ${swellPeriodValue !== null ? swellPeriodValue.toFixed(0) + " second period" : "Period unavailable"}.
        The selected swell is ${approach !== null ? approach.toFixed(0) + "°" : "--"} from the beach-facing direction and scores ${exposure}/10 for Barleycove exposure.
      </p>
      <div class="info-grid">
        <div class="info-item"><strong>Direction</strong><span>${directionText}</span></div>
        <div class="info-item"><strong>Period</strong><span>${swellPeriodValue !== null ? swellPeriodValue.toFixed(0) + " s" : "--"}</span></div>
        <div class="info-item"><strong>Exposure</strong><span>${exposure}/10</span></div>
      </div>
    `;
  } else if (condition === "wind") {
    conditionInfo.innerHTML = `
      <h3>${wind ? wind.speed.toFixed(0) + " kt " + degreesToCompass(wind.direction) : "--"}</h3>
      <p>
        Northerly and north-easterly winds are generally the most useful direction for Barleycove. This wind contributes ${score.factors.windDirection}/20 for direction and ${score.factors.windSpeed}/5 for speed.
      </p>
      <div class="info-grid">
        <div class="info-item"><strong>Direction</strong><span>${wind ? degreesToCompass(wind.direction) : "--"}</span></div>
        <div class="info-item"><strong>Speed</strong><span>${wind ? wind.speed.toFixed(0) + " kt" : "--"}</span></div>
        <div class="info-item"><strong>Wind score</strong><span>${score.factors.windDirection + score.factors.windSpeed}/25</span></div>
      </div>
    `;
  } else if (condition === "tide") {
    conditionInfo.innerHTML = `
      <h3>${tide ? tide.state + " tide" : "Tide unavailable"}</h3>
      <p>
        ${tide ? tide.height.toFixed(1) + " m predicted level. Previous and next tide points are used to determine whether the tide is rising or falling." : "The tide forecast could not be loaded for this time."}
      </p>
      <div class="info-grid">
        <div class="info-item"><strong>Level</strong><span>${tide ? tide.height.toFixed(1) + " m" : "--"}</span></div>
        <div class="info-item"><strong>State</strong><span>${tide ? tide.state : "--"}</span></div>
        <div class="info-item"><strong>Score</strong><span>${score.factors.tide}/10</span></div>
      </div>
    `;
  } else {
    const waterTemperature = getValue(data, "waterTemperature", index);

    conditionInfo.innerHTML = `
      <h3>${waterTemperature !== null ? waterTemperature.toFixed(1) + " °C" : "Water temperature unavailable"}</h3>
      <p>
        This is the forecast sea-surface temperature for the selected time. It comes from the Open-Meteo Marine API and is separate from air temperature.
      </p>
      <div class="info-grid">
        <div class="info-item"><strong>Temperature</strong><span>${waterTemperature !== null ? waterTemperature.toFixed(1) + " °C" : "--"}</span></div>
        <div class="info-item"><strong>Time</strong><span>${formatForecastDateTime(timestamp)}</span></div>
      </div>
    `;
  }
}

document.querySelectorAll(".condition-card").forEach((card) => {
  card.dataset.condition = card
    .querySelector(".condition-label")
    ?.textContent.trim()
    .toLowerCase();

  card.addEventListener("click", () => {
    selectedCondition = card.dataset.condition;

    if (forecastData) {
      updateConditionInfo(
        forecastData,
        selectedForecastIndex,
        selectedCondition,
      );

      document.querySelectorAll(".condition-card").forEach((item) => {
        item.classList.toggle("selected", item === card);
      });
    }
  });
});

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

  const barleycove = [51.46716, -9.77497];

  const map = L.map("surfMap").setView(barleycove, 15);

  window.surfMap = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  L.marker(barleycove).addTo(map).bindPopup("Barleycove Beach").openPopup();

  L.circle(barleycove, {
    radius: 350,
    weight: 2,
    opacity: 0.7,
    fillOpacity: 0.08,
  })
    .addTo(map)
    .bindTooltip("Barleycove surf area");

  L.marker(barleycove, {
    opacity: 0,
  }).addTo(map);
}

const submitReport = document.getElementById("submitReport");

const reportList = document.getElementById("reportList");

async function loadLocalReports() {
  if (!reportList) {
    return;
  }

  reportList.innerHTML = "";

  try {
    const { data, error } = await supabaseClient
      .from("surf_reports")
      .select("id, wave_height, wave_shape, crowd, created_at")
      .order("created_at", {
        ascending: false,
      })
      .limit(20);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      const emptyMessage = document.createElement("p");

      emptyMessage.textContent = "No surf reports yet.";

      reportList.appendChild(emptyMessage);

      return;
    }

    for (const report of data) {
      const card = document.createElement("article");

      card.className = "report-card";

      const top = document.createElement("div");

      top.className = "report-card-top";

      const height = document.createElement("div");

      height.className = "report-height";

      height.textContent = `${Number(report.wave_height).toFixed(1)} m`;

      const date = document.createElement("div");

      date.className = "report-date";

      date.textContent = new Date(report.created_at).toLocaleString("en-IE");

      top.appendChild(height);
      top.appendChild(date);

      const details = document.createElement("div");

      details.className = "report-details";

      const shape = document.createElement("span");

      shape.className = "report-tag";

      shape.textContent = report.wave_shape;

      const crowd = document.createElement("span");

      crowd.className = "report-tag";

      crowd.textContent = report.crowd;

      details.appendChild(shape);
      details.appendChild(crowd);

      card.appendChild(top);
      card.appendChild(details);

      reportList.appendChild(card);
    }
  } catch (error) {
    console.error("Could not load surf reports:", error);

    const errorMessage = document.createElement("p");

    errorMessage.textContent = "Surf reports are currently unavailable.";

    reportList.appendChild(errorMessage);
  }
}

if (submitReport) {
  submitReport.addEventListener("click", async () => {
    const heightElement = document.getElementById("reportHeight");

    const shapeElement = document.getElementById("reportShape");

    const crowdElement = document.getElementById("reportCrowd");

    if (!heightElement || !shapeElement || !crowdElement) {
      return;
    }

    const waveHeight = Number(heightElement.value);

    const waveShape = shapeElement.value;

    const crowd = crowdElement.value;

    submitReport.disabled = true;

    submitReport.textContent = "Saving...";

    try {
      const { error } = await supabaseClient.from("surf_reports").insert({
        wave_height: waveHeight,

        wave_shape: waveShape,

        crowd: crowd,
      });

      if (error) {
        throw error;
      }

      await loadLocalReports();
    } catch (error) {
      console.error("Could not save surf report:", error);

      alert("Could not save the surf report.");
    } finally {
      submitReport.disabled = false;

      submitReport.textContent = "Save report";
    }
  });
}

loadLocalReports();

initialiseSurfMap();

loadForecast();
