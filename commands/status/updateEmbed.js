const fs = require('fs');
const path = require('path');
const query = require('samp-query');
const { EmbedBuilder, ChannelType } = require('discord.js');

const server_ip = process.env.SAMP_HOST || '127.0.0.1';
const server_port = parseInt(process.env.SAMP_PORT) || 7777;
const interval_ms = 10_000;

const dataFile = path.join(__dirname, 'status_message.json');
let serverOnlineTime = new Date();
let messageEmbed;

function getFormattedWIBTime(date) {
  const tanggal = date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });

  const jam = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta'
  });

  return `${tanggal} ${jam} WIB`;
}

function formatUptime(startTime) {
  const now = new Date();
  const uptimeMs = now - startTime;
  const uptimeHours = Math.floor(uptimeMs / 3600000);
  const uptimeMinutes = Math.floor((uptimeMs % 3600000) / 60000);
  return `${uptimeHours} hrs, ${uptimeMinutes} mins`;
}

async function deletePreviousMessage(client, channelId) {
  if (!fs.existsSync(dataFile)) return;

  try {
    const { messageId } = JSON.parse(fs.readFileSync(dataFile));
    const channel = await client.channels.fetch(channelId);
    const msg = await channel.messages.fetch(messageId);
    if (msg) await msg.delete();
    console.log('[INFO] Pesan embed sebelumnya berhasil dihapus.');
  } catch (err) {
    console.warn('[WARN] Gagal menghapus pesan sebelumnya:', err.message);
  }
}

function startStatusUpdater(client, channelId) {
  const channel = client.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.error(`[ERROR] Channel ID ${channelId} tidak ditemukan atau bukan channel text.`);
    return;
  }

  deletePreviousMessage(client, channelId);

  setInterval(() => {
    const samp = { host: server_ip, port: server_port };
    const startPing = Date.now();

    query(samp, async (error, response) => {
      const endPing = Date.now();
      const pingMs = endPing - startPing;

      let uptimeString = "N/A";
      if (!error) uptimeString = formatUptime(serverOnlineTime);

      const embed = new EmbedBuilder()
        .setTitle('WINDCITY RP - Server Status')
        .setColor('#00cba9')
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: 'Status', value: error ? '`🔴 Offline`' : '`🟢 Online`', inline: true },
          { name: 'Players', value: error ? '`N/A`' : `\`${response.online}/${response.maxplayers}\``, inline: true },
          { name: 'Ping', value: error ? '`N/A`' : `\`${pingMs}ms\``, inline: true },
          { name: 'Version', value: error ? '`N/A`' : `\`${response.rules?.version || 'Unknown'}\``, inline: true },
          { name: 'Last Restart', value: `\`${getFormattedWIBTime(serverOnlineTime)}\``, inline: true },
          { name: 'Uptime', value: `\`${uptimeString}\``, inline: true },
          { name: 'Connect', value: `\`${server_ip}:${server_port}\`` }
        )
        .setTimestamp()
        .setFooter({
          text: '© 2025 WINDCITY RP - All rights reserved.',
          iconURL: client.user.displayAvatarURL()
        });

      if (!messageEmbed) {
        try {
          const msg = await channel.send({
            content: '',
            embeds: [embed]
          });
          messageEmbed = msg;
          fs.writeFileSync(dataFile, JSON.stringify({ messageId: msg.id }));
        } catch (e) {
          console.error('[ERROR] Gagal mengirim pesan embed:', e.message);
        }
      } else {
        messageEmbed.edit({ embeds: [embed] }).catch(console.error);
      }
    });
  }, interval_ms);
}

module.exports = { startStatusUpdater };
