const dares = [
  'Send a voice note singing your favourite song',
  'Change your profile picture to something embarrassing for 1 hour',
  'Text your crush right now',
  'Do 20 pushups right now',
  'Send a selfie with a funny face',
  'Call someone and talk in a funny accent for 1 minute',
  'Post something embarrassing on your status',
  'Let someone in the chat change your display name for 30 minutes',
  'Write a short poem about the last person who messaged you',
  'Send a voice message saying "I am a chicken" 5 times',
  'Set an alarm for 3am and screenshot it',
  'Send a voice note of you doing your best impression of a robot',
  'Tell an embarrassing story about yourself',
  'Send a video of you dancing for 10 seconds',
  'Compliment every person in this group chat',
];

export default {
  command: 'dare',
  alias: ['d'],
  description: 'Get a random dare challenge',
  category: 'fun',
  async execute({ reply }) {
    const d = dares[Math.floor(Math.random() * dares.length)];
    reply(`😈 *Truth or Dare — DARE*\n\n🎯 ${d}`);
  },
};
