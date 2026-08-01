import axios from 'axios';

export default {
  command: 'recipe',
  alias: ['food', 'cook'],
  description: 'Search for food recipes',
  category: 'search',
  async execute({ reply, text }) {
    if (!text) return reply('❌ Usage: .recipe [dish name]\nExample: .recipe pasta carbonara');
    try {
      const res = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(text)}`);
      const meal = res.data.meals?.[0];
      if (!meal) return reply(`❌ No recipe found for: *${text}*`);
      const ingredients = [];
      for (let i = 1; i <= 20; i++) {
        if (meal[`strIngredient${i}`]) {
          ingredients.push(`• ${meal[`strMeasure${i}`]?.trim() || ''} ${meal[`strIngredient${i}`]}`.trim());
        }
      }
      const instructions = meal.strInstructions?.substring(0, 600) || 'N/A';
      reply(`🍽️ *${meal.strMeal}*\n\n🌍 Category: ${meal.strCategory} | ${meal.strArea}\n\n🧂 *Ingredients:*\n${ingredients.slice(0, 10).join('\n')}\n\n📋 *Instructions:*\n${instructions}${meal.strInstructions?.length > 600 ? '...' : ''}\n\n🎥 ${meal.strYoutube || 'No video'}`);
    } catch {
      reply('❌ Failed to fetch recipe. Try again.');
    }
  },
};
