// ============================================
// AA MD Bot - Weather (Current)
// Free: Open-Meteo + Open-Meteo Geocoding
// No API key needed — accurate geocoding
// ============================================

import axios from 'axios';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WX_URL  = 'https://api.open-meteo.com/v1/forecast';

const WMO = {
  0:'☀️ Clear sky', 1:'🌤️ Mainly clear', 2:'⛅ Partly cloudy', 3:'☁️ Overcast',
  45:'🌫️ Fog', 48:'🌫️ Icy fog',
  51:'🌦️ Light drizzle', 53:'🌦️ Drizzle', 55:'🌧️ Heavy drizzle',
  61:'🌧️ Light rain', 63:'🌧️ Rain', 65:'🌧️ Heavy rain',
  71:'🌨️ Light snow', 73:'❄️ Snow', 75:'❄️ Heavy snow', 77:'🌨️ Snow grains',
  80:'🌦️ Showers', 81:'🌧️ Rain showers', 82:'⛈️ Violent showers',
  85:'🌨️ Snow showers', 86:'❄️ Heavy snow showers',
  95:'⛈️ Thunderstorm', 96:'⛈️ Thunderstorm+hail', 99:'⛈️ Heavy thunderstorm',
};

function wmo(code) { return WMO[code] || '🌡️ Unknown'; }

async function geocode(city) {
  const { data } = await axios.get(GEO_URL, {
    params: { name: city, count: 1, language: 'en', format: 'json' },
    timeout: 10000,
  });
  const r = data?.results?.[0];
  if (!r) throw new Error('City not found');
  return {
    lat:     r.latitude,
    lon:     r.longitude,
    name:    r.name,
    country: r.country || '',
    region:  r.admin1  || '',
  };
}

export default {
  command: 'weather',
  alias: ['wtr', 'temp', 'mausam'],
  description: 'Current weather for any city',
  category: 'search',

  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(
        `🌤️ *Weather*\n\n` +
        `*Usage:* ${prefix}weather <city>\n` +
        `*Example:* ${prefix}weather Dera Ghazi Khan\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('⏳');
    try {
      const loc = await geocode(text.trim());

      const { data } = await axios.get(WX_URL, {
        params: {
          latitude:   loc.lat,
          longitude:  loc.lon,
          current:    'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,surface_pressure,visibility,uv_index,precipitation',
          daily:      'sunrise,sunset,temperature_2m_max,temperature_2m_min',
          timezone:   'auto',
          forecast_days: 1,
        },
        timeout: 12000,
      });

      const c   = data.current;
      const d   = data.daily;
      const loc2 = `${loc.name}${loc.region ? ', ' + loc.region : ''}${loc.country ? ', ' + loc.country : ''}`;

      const text2 =
        `🌤️ *Weather — ${loc2}*\n` +
        `${'─'.repeat(30)}\n` +
        `${wmo(c.weather_code)}\n\n` +
        `🌡️ *Temp:* ${c.temperature_2m}°C  _(feels ${c.apparent_temperature}°C)_\n` +
        `📊 *Max/Min:* ${d.temperature_2m_max[0]}°C / ${d.temperature_2m_min[0]}°C\n` +
        `💧 *Humidity:* ${c.relative_humidity_2m}%\n` +
        `🌧️ *Precipitation:* ${c.precipitation} mm\n` +
        `☁️ *Cloud Cover:* ${c.cloud_cover}%\n` +
        `🎐 *Wind:* ${c.wind_speed_10m} km/h  (${c.wind_direction_10m}°)\n` +
        `👀 *Visibility:* ${(c.visibility / 1000).toFixed(1)} km\n` +
        `🔄 *Pressure:* ${c.surface_pressure} hPa\n` +
        `🔆 *UV Index:* ${c.uv_index}\n` +
        `🌅 *Sunrise:* ${d.sunrise[0].split('T')[1]}\n` +
        `🌇 *Sunset:* ${d.sunset[0].split('T')[1]}\n\n` +
        `> 🤖 *AA MD Bot*`;

      await sock.sendMessage(jid, { text: text2 }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *"${text}"* not found.\n\nPlease enter the full city name.\n_Example: Dera Ghazi Khan_\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
