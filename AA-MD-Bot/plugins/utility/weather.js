import axios from 'axios';

export default {
  command: 'weather',
  alias: ['w', 'forecast'],
  description: 'Get weather for a city',
  category: 'utility',
  async execute({ reply, text }) {
    if (!text) return reply('❌ Usage: .weather [city]\nExample: .weather Karachi');
    try {
      const apiKey = process.env.OPENWEATHER_API_KEY;
      if (!apiKey) {
        const res = await axios.get(`https://wttr.in/${encodeURIComponent(text)}?format=j1`);
        const data = res.data;
        const curr = data.current_condition[0];
        const area = data.nearest_area[0];
        const city = area.areaName[0].value;
        const country = area.country[0].value;
        const temp = curr.temp_C;
        const feels = curr.FeelsLikeC;
        const humid = curr.humidity;
        const desc = curr.weatherDesc[0].value;
        const wind = curr.windspeedKmph;
        return reply(`🌤️ *Weather - ${city}, ${country}*\n\n🌡️ Temp: *${temp}°C* (Feels like ${feels}°C)\n💧 Humidity: *${humid}%*\n💨 Wind: *${wind} km/h*\n☁️ Condition: *${desc}*`);
      }
      const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(text)}&appid=${apiKey}&units=metric`);
      const d = res.data;
      reply(`🌤️ *Weather - ${d.name}, ${d.sys.country}*\n\n🌡️ Temp: *${d.main.temp}°C* (Feels like ${d.main.feels_like}°C)\n💧 Humidity: *${d.main.humidity}%*\n💨 Wind: *${d.wind.speed} m/s*\n☁️ Condition: *${d.weather[0].description}*\n📊 Min/Max: *${d.main.temp_min}°C / ${d.main.temp_max}°C*`);
    } catch (err) {
      reply(`❌ Could not get weather for *${text}*. Check the city name.`);
    }
  },
};
