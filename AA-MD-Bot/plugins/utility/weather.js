import axios from 'axios';

const WEATHER_EMOJI = {
  'Sunny': '☀️', 'Clear': '🌙', 'Partly cloudy': '⛅',
  'Cloudy': '☁️', 'Overcast': '🌫️', 'Mist': '🌫️',
  'Patchy rain possible': '🌦️', 'Light rain': '🌧️',
  'Moderate rain': '🌧️', 'Heavy rain': '⛈️',
  'Thundery outbreaks possible': '⛈️', 'Blizzard': '🌨️',
  'Snow': '❄️', 'Fog': '🌫️', 'Freezing drizzle': '🌨️',
};

function wEmoji(desc) {
  for (const [k, v] of Object.entries(WEATHER_EMOJI)) {
    if (desc.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return '🌤️';
}

function formatHour(timeStr) {
  const h = Math.floor(parseInt(timeStr) / 100);
  return h === 0 ? '12AM' : h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`;
}

function windDir(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export default {
  command: 'weather',
  alias: ['w', 'forecast', 'hawa'],
  description: 'Accurate weather + 24h forecast',
  category: 'utility',

  async execute({ reply, text, args }) {
    const city = (text || args.join(' ')).trim();
    if (!city) return reply('❌ Usage: .weather Karachi\n.weather London\n.weather New York');

    try {
      const { data } = await axios.get(
        `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
        { timeout: 12000, headers: { 'User-Agent': 'curl/7.0' } }
      );

      const curr   = data.current_condition[0];
      const area   = data.nearest_area[0];
      const city_  = area.areaName?.[0]?.value || city;
      const region = area.region?.[0]?.value || '';
      const country= area.country?.[0]?.value || '';
      const loc    = [city_, region, country].filter(Boolean).join(', ');

      const tempC  = curr.temp_C;
      const feelsC = curr.FeelsLikeC;
      const humid  = curr.humidity;
      const desc   = curr.weatherDesc?.[0]?.value || 'Clear';
      const wind   = curr.windspeedKmph;
      const wdDir  = windDir(parseInt(curr.winddirDegree || 0));
      const vis    = curr.visibility;
      const uv     = curr.uvIndex;
      const cloud  = curr.cloudcover;
      const emoji  = wEmoji(desc);

      // Today's forecast from wttr.in (day 0)
      const today    = data.weather[0];
      const maxC     = today.maxtempC;
      const minC     = today.mintempC;
      const todayDesc= today.hourly?.[4]?.weatherDesc?.[0]?.value || desc;

      // Next 24 hours — use today's remaining hours + tomorrow's first hours
      const todayHours = (today.hourly || []).filter(h => {
        const hour = Math.floor(parseInt(h.time) / 100);
        const now  = new Date().getHours();
        return hour >= now;
      });
      const tomorrowHours = (data.weather[1]?.hourly || []).slice(0, 4);
      const next24 = [...todayHours, ...tomorrowHours].slice(0, 8);

      let msg = '';
      msg += `╔═══════════════════════════╗\n`;
      msg += `║  ${emoji} *WEATHER UPDATE*  ${emoji}\n`;
      msg += `║  📍 ${loc}\n`;
      msg += `╚═══════════════════════════╝\n\n`;

      msg += `🌡️ *Now:* ${tempC}°C  _(feels ${feelsC}°C)_\n`;
      msg += `☁️ *Condition:* ${desc}\n`;
      msg += `🌬️ *Wind:* ${wind} km/h ${wdDir}\n`;
      msg += `💧 *Humidity:* ${humid}%\n`;
      msg += `☀️ *UV Index:* ${uv}\n`;
      msg += `👁️ *Visibility:* ${vis} km\n`;
      msg += `☁️ *Cloud Cover:* ${cloud}%\n`;
      msg += `📊 *Today's Range:* ${minC}°C — ${maxC}°C\n\n`;

      // 24-hour forecast section
      msg += `┌──── 🕐 *NEXT 24 HOURS* ────┐\n`;
      for (const h of next24) {
        const hr   = formatHour(h.time);
        const hT   = h.tempC;
        const hD   = h.weatherDesc?.[0]?.value || '';
        const hR   = h.chanceofrain;
        const hW   = h.windspeedKmph;
        const hEm  = wEmoji(hD);
        const rain = parseInt(hR) > 30 ? ` 🌧️${hR}%` : '';
        msg += `│ ${String(hr).padEnd(5)} ${hEm} *${hT}°C*  💨${hW}km/h${rain}\n`;
      }
      msg += `└────────────────────────────┘\n\n`;

      // Tomorrow's summary
      const tmr = data.weather[1];
      if (tmr) {
        const tmrMax = tmr.maxtempC;
        const tmrMin = tmr.mintempC;
        const tmrDesc= tmr.hourly?.[4]?.weatherDesc?.[0]?.value || '';
        const tmrEm  = wEmoji(tmrDesc);
        msg += `📅 *Tomorrow:* ${tmrEm} ${tmrMin}°C — ${tmrMax}°C\n`;
        msg += `   _${tmrDesc}_\n\n`;
      }

      msg += `🌐 https://aa-mods.vercel.app/`;

      return reply(msg);
    } catch (err) {
      console.error('[weather]', err.message);
      return reply(
        `❌ *Weather fetch failed* for: *${city}*\n\n` +
        `💡 Tips:\n` +
        `• Check spelling — try English city name\n` +
        `• Examples: *.weather Karachi* | *.weather Dubai* | *.weather London*`
      );
    }
  },
};
