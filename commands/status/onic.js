const query = require('samp-query');

const server_ip = process.env.SAMP_HOST || '127.0.0.1';
const server_port = parseInt(process.env.SAMP_PORT) || 7777;

async function handleOnIC(message) {
  if (message.author.bot || !message.guild) return;
  const content = message.content.toLowerCase();

  // Deteksi pesan mengandung "on ic"
  if (content.includes('on ic')) {
    const startPing = Date.now();

    query({ host: server_ip, port: server_port }, async (error, response) => {
      const online = error ? 0 : response.online;
      const max = error ? 0 : response.maxplayers;

      const text = `Ada ${online}/${max} players in-game, Ayo Hytamkan Kota!`;
      await message.reply(text);
    });
  }
}

module.exports = handleOnIC;