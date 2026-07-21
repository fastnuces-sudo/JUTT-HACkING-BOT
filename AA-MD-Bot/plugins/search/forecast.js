// ============================================
// AA MD Bot - 7-Day Weather Forecast
// Free: Open-Meteo + Open-Meteo Geocoding
// No API key needed — accurate geocoding
// ============================================

import axios from 'axios';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WX_URL  = 'https://api.open-meteo.com/v1/forecast';

const WMO = {
  0:'☀️ Clear', 1:'🌤️ Mainly clear', 2:'⛅ Partly cloudy', 3:'☁️ Overcast',
  45:'🌫️ Fog', 48:'🌫️ Icy fog',
  51:'🌦️ Lt drizzle', 53:'🌦️ Drizzle', 55:'🌧️ Hvy drizzle',
  61:'🌧️ Lt rain', 63:'🌧️ Rain', 65:'🌧️ Hvy rain',
  71:'🌨️ Lt snow', 73:'❄️ Snow', 75:'❄️ Hvy snow', 77:'🌨️ Snow grains',
  80:'🌦️ Showers', 81:'🌧️ Rain showers', 82:'⛈️ Vlnt showers',
  85:'🌨️ Snow showers', 86:'❄️ Hvy snow showers',
  95:'⛈️ Thunderstorm', 96:'⛈️ T-storm+hail', 99:'⛈️ Hvy T-storm',
};

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function wmo(code) { return WMO[code] || '🌡️'; }

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
  command: 'forecast',
  alias: ['7day', 'week', 'fcst'],
  description: '7-day weather forecast for any city',
  category: 'search',

  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(
        `📅 *7-Day Forecast*\n\n` +
        `*Usage:* ${prefix}forecast <city>\n` +
        `*Example:* ${prefix}forecast Dera Ghazi Khan\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('⏳');
    try {
      const loc = await geocode(text.trim());

      const { data } = await axios.get(WX_URL, {
        params: {
          latitude:      loc.lat,
          longitude:     loc.lon,
          daily:         'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset,precipitation_probability_max',
          timezone:      'auto',
          forecast_days: 7,
        },
        timeout: 12000,
      });

      const d    = data.daily;
      const loc2 = `${loc.name}${loc.region ? ', ' + loc.region : ''}${loc.country ? ', ' + loc.country : ''}`;

      let out = `📅 *7-Day Forecast*\n*${loc2}*\n${'─'.repeat(30)}\n`;

      for (let i = 0; i < 7; i++) {
        const date    = new Date(d.time[i] + 'T00:00:00');
        const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYS[date.getDay()];
        const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
        const cond    = wmo(d.weather_code[i]);
        const max     = d.temperature_2m_max[i];
        const min     = d.temperature_2m_min[i];
        const rain    = d.precipitation_sum[i];
        const rainPct = d.precipitation_probability_max[i];
        const wind    = d.wind_speed_10m_max[i];
        const uv      = d.uv_index_max[i];
        const sunrise = d.sunrise[i].split('T')[1];
        const sunset  = d.sunset[i].split('T')[1];

        out += `\n*${dayName}* _(${dateStr})_\n`;
        out += `${cond}\n`;
        out += `🌡️ ${max}°C / ${min}°C  💧 ${rainPct}% rain (${rain}mm)\n`;
        out += `🎐 ${wind} km/h  🔆 UV ${uv}  🌅 ${sunrise} 🌇 ${sunset}\n`;
        if (i < 6) out += `${'─'.repeat(28)}\n`;
      }

      out += `\n> 🤖 *AA MD Bot*`;

      await sock.sendMessage(jid, { text: out }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *"${text}"* not found.\n\nPlease enter the full city name.\n_Example: Dera Ghazi Khan_\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
