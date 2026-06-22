import axios from 'axios';

export default {
  command: 'weather',
  alias: ['wtr'],
  description: 'Get weather report for a city',
  category: 'search',
  async execute({ sock, msg, jid, text, react, reply, prefix, config }) {
    if (!text) {
      await react('❔');
      return reply(`Please provide a city name !\n\n*${prefix}weather Karachi*`);
    }
    await react('🌤');
    try {
      const apiKey = config?.apiKeys?.openweather || process.env.OPENWEATHER_API_KEY || 'e409825a497a0c894d2dd975542234b0';
      const myweather = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(text)}&units=metric&appid=${apiKey}&language=tr`
      );
      const d = myweather.data;
      let weathertext = `           🌤 *Weather Report* 🌤  \n\n🔎 *Search Location:* ${d.name}\n*💮 Country:* ${d.sys.country}\n🌈 *Weather:* ${d.weather[0].description}\n🌡️ *Temperature:* ${d.main.temp}°C\n❄️ *Minimum Temperature:* ${d.main.temp_min}°C\n📛 *Maximum Temperature:* ${d.main.temp_max}°C\n💦 *Humidity:* ${d.main.humidity}%\n🎐 *Wind:* ${d.wind.speed} m/s\n🌅 *Sunrise:* ${new Date(d.sys.sunrise * 1000).toLocaleTimeString()}\n🌇 *Sunset:* ${new Date(d.sys.sunset * 1000).toLocaleTimeString()}`;
      await sock.sendMessage(jid, {
        video: { url: 'https://media.tenor.com/bC57J4v11UcAAAPo/weather-sunny.mp4' },
        gifPlayback: true,
        caption: weathertext,
      }, { quoted: msg });
    } catch (err) {
      console.error('Weather error:', err);
      await react('❌');
      return reply(`❌ City not found or weather API error: *${text}*`);
    }
  },
};
