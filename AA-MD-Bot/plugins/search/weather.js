// ============================================
// AA MD Bot - Weather Report
// Uses wttr.in (free, no API key needed)
// ============================================

import axios from 'axios';

export default {
  command: 'weather',
  alias: ['wtr', 'forecast', 'temp'],
  description: 'Get weather report for any city',
  category: 'search',

  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(
        `🌤️ *Weather Report*\n\n` +
        `*Usage:* ${prefix}weather <city>\n` +
        `*Example:* ${prefix}weather Karachi\n\n` +
        `> 🌤️ *AA MD Bot*`
      );
    }

    await react('🌤️');

    try {
      const city = text.trim();
      const { data } = await axios.get(
        `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
        { timeout: 15000 }
      );

      const cur  = data.current_condition[0];
      const area = data.nearest_area[0];
      const fcst = data.weather;

      const cityName    = area.areaName[0]?.value || city;
      const country     = area.country[0]?.value || '';
      const tempC       = cur.temp_C;
      const tempF       = cur.temp_F;
      const feelsC      = cur.FeelsLikeC;
      const humidity    = cur.humidity;
      const wind        = cur.windspeedKmph;
      const windDir     = cur.winddir16Point;
      const visibility  = cur.visibility;
      const pressure    = cur.pressure;
      const uvIndex     = cur.uvIndex;
      const description = cur.weatherDesc[0]?.value || 'N/A';
      const cloud       = cur.cloudcover;

      // Sunrise/sunset from first forecast day
      const sunrise  = fcst[0]?.astronomy[0]?.sunrise  || 'N/A';
      const sunset   = fcst[0]?.astronomy[0]?.sunset   || 'N/A';
      const maxTempC = fcst[0]?.maxtempC || tempC;
      const minTempC = fcst[0]?.mintempC || tempC;

      const weatherText =
        `🌤️ *Weather Report*\n\n` +
        `📍 *${cityName}${country ? `, ${country}` : ''}*\n` +
        `${'─'.repeat(28)}\n` +
        `🌡️ *Temperature:* ${tempC}°C / ${tempF}°F\n` +
        `🌡️ *Feels Like:* ${feelsC}°C\n` +
        `📊 *Max/Min:* ${maxTempC}°C / ${minTempC}°C\n` +
        `🌥️ *Condition:* ${description}\n` +
        `☁️ *Cloud Cover:* ${cloud}%\n` +
        `💧 *Humidity:* ${humidity}%\n` +
        `🎐 *Wind:* ${wind} km/h ${windDir}\n` +
        `👀 *Visibility:* ${visibility} km\n` +
        `🔄 *Pressure:* ${pressure} hPa\n` +
        `🔆 *UV Index:* ${uvIndex}\n` +
        `🌅 *Sunrise:* ${sunrise}\n` +
        `🌇 *Sunset:* ${sunset}\n\n` +
        `> 🌤️ *AA MD Bot*`;

      await sock.sendMessage(jid, { text: weatherText }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(
        `❌ City not found: *${text}*\n\n` +
        `Make sure the city name is correct.\n` +
        `*Example:* ${prefix}weather Lahore\n\n` +
        `> 🌤️ *AA MD Bot*`
      );
    }
  },
};
