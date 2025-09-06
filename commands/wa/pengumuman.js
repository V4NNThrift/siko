module.exports = {
  name: 'pengumuman',
  async execute({ sock, msg, args }) {
    const isi = args.join(' ');
    if (!isi) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: '⚠️ Format salah!\nGunakan: `!pengumuman isi pengumuman`'
      });
    }

    const channelId = process.env.ANNOUNCE_CHANNEL_ID;
    const client = global.discordClient;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Channel Discord tidak ditemukan atau bukan text channel.'
      });
    }

    await channel.send({
      content: `📢 Pengumuman:\n\n${isi}\n\n\n@everyone`,
      allowedMentions: { parse: ['everyone'] }
    });

    await sock.sendMessage(msg.key.remoteJid, {
      text: '✅ Pengumuman berhasil dikirim ke Discord.'
    });
  }
};