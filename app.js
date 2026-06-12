const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  location: {
    name: "Vienna",
    country: "Austria",
    latitude: 48.2082,
    longitude: 16.3738,
  },
  weather: null,
  timezone: "Europe/Vienna",
  audio: null,
  soundOn: false,
  particles: [],
  pointer: { x: innerWidth / 2, y: innerHeight / 2, active: false },
};

const fallbackWeather = {
  current: {
    time: new Date().toISOString(),
    temperature_2m: 21,
    relative_humidity_2m: 58,
    apparent_temperature: 20,
    is_day: 1,
    precipitation: 0,
    weather_code: 2,
    cloud_cover: 34,
    pressure_msl: 1017,
    wind_speed_10m: 12,
    wind_direction_10m: 310,
    wind_gusts_10m: 21,
  },
  hourly: {
    time: Array.from({ length: 48 }, (_, index) => {
      const date = new Date();
      date.setMinutes(0, 0, 0);
      date.setHours(date.getHours() + index);
      return date.toISOString().slice(0, 16);
    }),
    temperature_2m: Array.from(
      { length: 48 },
      (_, index) => 18 + Math.sin(index / 4) * 5
    ),
    precipitation_probability: Array.from(
      { length: 48 },
      (_, index) => Math.max(0, Math.sin(index / 5) * 20)
    ),
    weather_code: Array(48).fill(2),
    wind_speed_10m: Array.from(
      { length: 48 },
      (_, index) => 10 + Math.cos(index / 3) * 4
    ),
    wind_direction_10m: Array(48).fill(310),
    cloud_cover: Array.from(
      { length: 48 },
      (_, index) => 35 + Math.sin(index / 4) * 20
    ),
  },
  daily: {
    temperature_2m_max: [24, 23],
    temperature_2m_min: [14, 13],
    sunrise: ["2026-06-12T04:53", "2026-06-13T04:53"],
    sunset: ["2026-06-12T20:56", "2026-06-13T20:57"],
  },
  timezone: "Europe/Vienna",
  timezone_abbreviation: "CEST",
};

const weatherLanguage = {
  0: ["clear", "is completely awake."],
  1: ["mostly clear", "is almost transparent."],
  2: ["partly veiled", "is wearing a thin veil."],
  3: ["overcast", "has lowered the ceiling."],
  45: ["fog", "has erased the horizon."],
  48: ["rime fog", "is collecting at the edges."],
  51: ["light drizzle", "is speaking in pinpricks."],
  53: ["drizzle", "is quietly stippled."],
  55: ["heavy drizzle", "is beading on every surface."],
  56: ["freezing drizzle", "has turned delicate and sharp."],
  57: ["freezing drizzle", "has turned delicate and sharp."],
  61: ["light rain", "is moving in silver threads."],
  63: ["rain", "is in constant motion."],
  65: ["heavy rain", "is falling with conviction."],
  66: ["freezing rain", "is glass at the edges."],
  67: ["freezing rain", "is glass at the edges."],
  71: ["light snow", "is shedding white noise."],
  73: ["snow", "is softening every outline."],
  75: ["heavy snow", "has nearly disappeared."],
  77: ["snow grains", "is full of white static."],
  80: ["rain showers", "is passing through quickly."],
  81: ["rain showers", "is breaking into showers."],
  82: ["violent showers", "is drumming on the roof."],
  85: ["snow showers", "is moving in white bursts."],
  86: ["heavy snow showers", "is a field of white noise."],
  95: ["thunderstorm", "is electrically unsettled."],
  96: ["storm with hail", "is charged and percussive."],
  99: ["storm with hail", "is charged and percussive."],
};

const palettes = {
  clearDay: { paper: "#d9ff47", wash: "#8bc8ff", signal: "#ff5c35", ink: "#141414" },
  cloudDay: { paper: "#d8d6cd", wash: "#aab6d8", signal: "#ff583d", ink: "#161616" },
  rainDay: { paper: "#9db4ba", wash: "#5f7d8f", signal: "#ffdc56", ink: "#101820" },
  snowDay: { paper: "#eeeadd", wash: "#bfd7e8", signal: "#ff4938", ink: "#14222a" },
  stormDay: { paper: "#a6a0c4", wash: "#49425e", signal: "#d9ff47", ink: "#101015" },
  night: { paper: "#11151f", wash: "#232c47", signal: "#ff643f", ink: "#e8e4d9" },
};

function getPalette(current) {
  if (!current.is_day) return palettes.night;
  if (current.weather_code >= 95) return palettes.stormDay;
  if (current.weather_code >= 71 && current.weather_code <= 86) return palettes.snowDay;
  if (current.weather_code >= 51) return palettes.rainDay;
  if (current.cloud_cover > 65) return palettes.cloudDay;
  return palettes.clearDay;
}

function applyPalette(current) {
  const palette = getPalette(current);
  const root = document.documentElement;
  root.style.setProperty("--paper", palette.paper);
  root.style.setProperty("--wash", palette.wash);
  root.style.setProperty("--signal", palette.signal);
  root.style.setProperty("--ink", palette.ink);
  root.style.setProperty("--soft-ink", hexWithAlpha(palette.ink, 0.62));
  root.style.setProperty("--line", hexWithAlpha(palette.ink, 0.34));
  document
    .querySelector('meta[name="theme-color"]')
    .setAttribute("content", palette.paper);
}

function hexWithAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function fetchWeather(location = state.location) {
  setStatus("Tuning signal", false);
  const params = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "pressure_msl",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
    ].join(","),
    hourly: [
      "temperature_2m",
      "precipitation_probability",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "cloud_cover",
    ].join(","),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "sunrise",
      "sunset",
    ].join(","),
    timezone: "auto",
    forecast_days: "2",
  });

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`
    );
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
    const weather = await response.json();
    state.weather = weather;
    state.timezone = weather.timezone;
    renderWeather();
    setStatus("Live atmospheric data", true);
  } catch (error) {
    console.warn(error);
    state.weather = fallbackWeather;
    state.timezone = fallbackWeather.timezone;
    renderWeather();
    setStatus("Demo signal / offline", false);
  } finally {
    window.setTimeout(() => {
      $("#loading-screen").classList.add("is-hidden");
    }, 550);
  }
}

function renderWeather() {
  const { current, daily } = state.weather;
  const language = weatherLanguage[current.weather_code] || [
    "changing",
    "is between definitions.",
  ];
  const location = state.location;

  applyPalette(current);
  $("#city-name").textContent = location.name;
  $("#condition-word").textContent = language[1];
  $("#coordinates").textContent = formatCoordinates(
    location.latitude,
    location.longitude
  );
  $("#temperature").textContent = Math.round(current.temperature_2m);
  $("#feels-like").textContent = `${Math.round(current.apparent_temperature)}°`;
  $("#temp-range").textContent = `${Math.round(
    daily.temperature_2m_min[0]
  )}° — ${Math.round(daily.temperature_2m_max[0])}°`;
  $("#wind").innerHTML = `${Math.round(
    current.wind_speed_10m
  )} <small>km/h</small>`;
  $("#wind-arrow").style.transform = `rotate(${current.wind_direction_10m}deg)`;
  $("#humidity").innerHTML = `${Math.round(
    current.relative_humidity_2m
  )}<small>%</small>`;
  $("#humidity-meter").style.width = `${current.relative_humidity_2m}%`;
  $("#pressure").innerHTML = `${Math.round(
    current.pressure_msl
  )} <small>hPa</small>`;
  $("#pressure-note").textContent = pressureNote(current.pressure_msl);
  $("#cloud").innerHTML = `${Math.round(current.cloud_cover)}<small>%</small>`;
  $("#observation-copy").textContent = observationFor(current, language[0]);
  $("#edition-date").textContent = formatDate(new Date());
  buildCloudBars(current.cloud_cover);
  buildForecast();
  resetParticles();
  updateAudioWeather();
}

function observationFor(current, condition) {
  const windMood =
    current.wind_speed_10m < 8
      ? "barely moving"
      : current.wind_speed_10m < 25
      ? "moving with purpose"
      : "running fast";
  const humidityMood =
    current.relative_humidity_2m > 75
      ? "heavy with moisture"
      : current.relative_humidity_2m < 35
      ? "dry at the edges"
      : "softly balanced";
  return `${capitalize(condition)} air, ${humidityMood}. The wind is ${windMood} at ${Math.round(
    current.wind_speed_10m
  )} kilometers per hour.`;
}

function pressureNote(value) {
  if (value < 1005) return "low / shifting";
  if (value > 1022) return "high / settled";
  return "steady signal";
}

function buildCloudBars(amount) {
  const bars = $("#cloud-bars");
  bars.innerHTML = "";
  for (let index = 0; index < 18; index += 1) {
    const bar = document.createElement("i");
    const wave = Math.sin(index * 0.82) * 7;
    const height = Math.max(2, (amount / 100) * 28 + wave);
    bar.style.height = `${height}px`;
    bars.appendChild(bar);
  }
}

function buildForecast() {
  const hourly = state.weather.hourly;
  const rail = $("#forecast-rail");
  rail.innerHTML = "";

  const now = new Date();
  const currentHour = now.getHours();
  let startIndex = hourly.time.findIndex((time) => {
    const hour = Number(time.slice(11, 13));
    return hour >= currentHour;
  });
  if (startIndex < 0) startIndex = 0;

  for (let index = 0; index < 8; index += 1) {
    const dataIndex = Math.min(startIndex + index * 3, hourly.time.length - 1);
    const item = document.createElement("article");
    const time = hourly.time[dataIndex];
    const hour = Number(time.slice(11, 13));
    const rain = Math.round(hourly.precipitation_probability[dataIndex] || 0);
    const code = hourly.weather_code[dataIndex];
    const label = weatherLanguage[code]?.[0] || "changing";
    item.className = `forecast-item${index === 0 ? " current" : ""}`;
    item.innerHTML = `
      <span class="forecast-time">${index === 0 ? "Now" : formatHour(hour)}</span>
      <div
        class="forecast-glyph"
        style="--cloudiness: ${(hourly.cloud_cover[dataIndex] || 0) / 100}; --wind-angle: ${
      hourly.wind_direction_10m[dataIndex] || 0
    }deg"
        title="${capitalize(label)}"
      ></div>
      <div>
        <span class="forecast-temp">${Math.round(
          hourly.temperature_2m[dataIndex]
        )}°</span>
        <div class="forecast-detail">
          <span>${rain}% rain</span>
          <span>${Math.round(hourly.wind_speed_10m[dataIndex])} km/h</span>
        </div>
      </div>
    `;
    rail.appendChild(item);
  }
}

function formatCoordinates(lat, lon) {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"} / ${Math.abs(
    lon
  ).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
}

function formatDate(date) {
  return [date.getDate(), date.getMonth() + 1, date.getFullYear()]
    .map((part) => String(part).padStart(2, "0"))
    .join(" — ");
}

function formatHour(hour) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 || 12;
  return `${normalized} ${suffix}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function setStatus(message, live) {
  $("#status-text").textContent = message;
  $("#status-dot").style.animationPlayState = live ? "running" : "paused";
}

function updateClock() {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: state.timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
    $("#local-clock").textContent = formatter
      .format(new Date())
      .replace(",", "");
  } catch {
    $("#local-clock").textContent = new Date().toLocaleTimeString();
  }
}

const canvas = $("#weather-field");
const context = canvas.getContext("2d");

function resizeCanvas() {
  const ratio = Math.min(devicePixelRatio, 2);
  canvas.width = innerWidth * ratio;
  canvas.height = innerHeight * ratio;
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  resetParticles();
}

function resetParticles() {
  const wind = state.weather?.current?.wind_speed_10m || 12;
  const count = Math.min(170, Math.max(55, Math.round(innerWidth / 9)));
  state.particles = Array.from({ length: count }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    size: Math.random() * 1.2 + 0.3,
    speed: (Math.random() * 0.45 + 0.12) * (1 + wind / 35),
    drift: Math.random() * Math.PI * 2,
    alpha: Math.random() * 0.45 + 0.08,
  }));
}

function drawField(time = 0) {
  const current = state.weather?.current || fallbackWeather.current;
  const palette = getPalette(current);
  context.clearRect(0, 0, innerWidth, innerHeight);

  const gradient = context.createRadialGradient(
    innerWidth * 0.72,
    innerHeight * 0.25,
    20,
    innerWidth * 0.72,
    innerHeight * 0.25,
    Math.max(innerWidth, innerHeight) * 0.8
  );
  gradient.addColorStop(0, hexWithAlpha(palette.wash, current.is_day ? 0.72 : 0.4));
  gradient.addColorStop(0.55, hexWithAlpha(palette.paper, 0.15));
  gradient.addColorStop(1, hexWithAlpha(palette.paper, 0));
  context.fillStyle = gradient;
  context.fillRect(0, 0, innerWidth, innerHeight);

  drawContours(time, palette.ink, current);
  drawParticles(time, palette.ink, current);
  requestAnimationFrame(drawField);
}

function drawContours(time, ink, current) {
  context.save();
  context.lineWidth = 0.6;
  context.strokeStyle = hexWithAlpha(ink, current.is_day ? 0.13 : 0.1);

  const centerX =
    innerWidth * 0.74 + Math.sin(time * 0.00008) * innerWidth * 0.04;
  const centerY =
    innerHeight * 0.25 + Math.cos(time * 0.0001) * innerHeight * 0.04;

  for (let ring = 0; ring < 9; ring += 1) {
    context.beginPath();
    const radius = 80 + ring * 58 + Math.sin(time * 0.0004 + ring) * 8;
    for (let angle = 0; angle <= Math.PI * 2 + 0.03; angle += 0.03) {
      const noise =
        Math.sin(angle * 3 + ring * 0.7 + time * 0.00015) * 13 +
        Math.cos(angle * 5 - time * 0.00012) * 7;
      const x = centerX + Math.cos(angle) * (radius + noise) * 1.55;
      const y = centerY + Math.sin(angle) * (radius + noise) * 0.72;
      if (angle === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.stroke();
  }
  context.restore();
}

function drawParticles(time, ink, current) {
  const radians = ((current.wind_direction_10m - 90) * Math.PI) / 180;
  const velocityX = Math.cos(radians);
  const velocityY = Math.sin(radians);

  context.save();
  state.particles.forEach((particle) => {
    const distance = Math.hypot(
      particle.x - state.pointer.x,
      particle.y - state.pointer.y
    );
    const pointerPull =
      state.pointer.active && distance < 180 ? (180 - distance) / 180 : 0;

    particle.x +=
      velocityX * particle.speed +
      Math.sin(time * 0.0004 + particle.drift) * 0.1;
    particle.y +=
      velocityY * particle.speed +
      Math.cos(time * 0.0003 + particle.drift) * 0.1;

    if (pointerPull) {
      particle.x += (state.pointer.x - particle.x) * pointerPull * 0.008;
      particle.y += (state.pointer.y - particle.y) * pointerPull * 0.008;
    }

    if (particle.x < -10) particle.x = innerWidth + 10;
    if (particle.x > innerWidth + 10) particle.x = -10;
    if (particle.y < -10) particle.y = innerHeight + 10;
    if (particle.y > innerHeight + 10) particle.y = -10;

    context.beginPath();
    context.fillStyle = hexWithAlpha(
      ink,
      particle.alpha * (current.is_day ? 1 : 0.8)
    );
    context.arc(
      particle.x,
      particle.y,
      particle.size + pointerPull * 1.5,
      0,
      Math.PI * 2
    );
    context.fill();
  });
  context.restore();
}

function setupSearch() {
  const dialog = $("#search-dialog");
  const input = $("#city-search");
  let timer;

  $("#open-search").addEventListener("click", () => {
    dialog.showModal();
    window.setTimeout(() => input.focus(), 250);
  });

  input.addEventListener("input", () => {
    clearTimeout(timer);
    $("#search-number").textContent = String(input.value.length).padStart(2, "0");
    timer = setTimeout(() => searchCities(input.value.trim()), 320);
  });

  $$(".quick-places button").forEach((button) => {
    button.addEventListener("click", () => {
      selectLocation({
        name: button.dataset.city,
        country: button.dataset.country,
        latitude: Number(button.dataset.lat),
        longitude: Number(button.dataset.lon),
      });
    });
  });
}

async function searchCities(query) {
  const results = $("#search-results");
  if (query.length < 2) {
    results.innerHTML = "";
    return;
  }

  results.innerHTML = '<p class="searching">Scanning the map…</p>';

  try {
    const params = new URLSearchParams({
      name: query,
      count: "6",
      language: "en",
      format: "json",
    });
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?${params}`
    );
    if (!response.ok) throw new Error("Location search failed");
    const data = await response.json();
    renderSearchResults(data.results || []);
  } catch (error) {
    console.warn(error);
    results.innerHTML =
      '<p class="searching">The map is quiet. Try a known frequency below.</p>';
  }
}

function renderSearchResults(locations) {
  const results = $("#search-results");
  results.innerHTML = "";

  if (!locations.length) {
    results.innerHTML = '<p class="searching">No signal found.</p>';
    return;
  }

  locations.forEach((location) => {
    const button = document.createElement("button");
    button.className = "result-button";
    button.type = "button";
    const region = [location.admin1, location.country].filter(Boolean).join(", ");
    button.innerHTML = `<span>${location.name}</span><small>${region}</small>`;
    button.addEventListener("click", () =>
      selectLocation({
        name: location.name,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
      })
    );
    results.appendChild(button);
  });
}

function selectLocation(location) {
  state.location = location;
  $("#search-dialog").close();
  $("#city-search").value = "";
  $("#search-results").innerHTML = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
  fetchWeather(location);
}

function createAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContext();
  const master = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const oscillatorA = audioContext.createOscillator();
  const oscillatorB = audioContext.createOscillator();
  const gainA = audioContext.createGain();
  const gainB = audioContext.createGain();

  oscillatorA.type = "sine";
  oscillatorB.type = "triangle";
  gainA.gain.value = 0.035;
  gainB.gain.value = 0.018;
  filter.type = "lowpass";
  master.gain.value = 0;

  oscillatorA.connect(gainA).connect(filter);
  oscillatorB.connect(gainB).connect(filter);
  filter.connect(master).connect(audioContext.destination);
  oscillatorA.start();
  oscillatorB.start();

  state.audio = {
    context: audioContext,
    master,
    filter,
    oscillatorA,
    oscillatorB,
  };
  updateAudioWeather();
}

function updateAudioWeather() {
  if (!state.audio || !state.weather) return;
  const current = state.weather.current;
  const now = state.audio.context.currentTime;
  const base = 88 + Math.max(-20, current.temperature_2m) * 1.7;
  state.audio.oscillatorA.frequency.setTargetAtTime(base, now, 1);
  state.audio.oscillatorB.frequency.setTargetAtTime(base * 1.498, now, 1.2);
  state.audio.filter.frequency.setTargetAtTime(
    380 + current.cloud_cover * 10 + current.wind_speed_10m * 8,
    now,
    0.8
  );
}

async function toggleSound() {
  if (!state.audio) createAudio();
  if (state.audio.context.state === "suspended") await state.audio.context.resume();

  state.soundOn = !state.soundOn;
  const now = state.audio.context.currentTime;
  state.audio.master.gain.cancelScheduledValues(now);
  state.audio.master.gain.setTargetAtTime(state.soundOn ? 0.62 : 0, now, 0.35);
  $("#sound-toggle").setAttribute("aria-pressed", String(state.soundOn));
  $("#sound-label").textContent = state.soundOn
    ? "Weather is sounding"
    : "Hear this weather";
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("pointermove", (event) => {
  state.pointer.x = event.clientX;
  state.pointer.y = event.clientY;
  state.pointer.active = true;
});
document.documentElement.addEventListener("pointerleave", () => {
  state.pointer.active = false;
});
$("#sound-toggle").addEventListener("click", toggleSound);

resizeCanvas();
setupSearch();
updateClock();
setInterval(updateClock, 1000);
requestAnimationFrame(drawField);
fetchWeather();
