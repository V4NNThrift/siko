require('dotenv').config();
const { EmbedBuilder } = require('discord.js');
const { PlayerUCP } = require('../../db');

const ALLOWED_ROLE_IDS = process.env.CEKUCP_ROLE_IDS
  ? process.env.ALLOWED_ROLE_IDS.split(',').map(id => id.trim())
  : [];

module.exports = {
  name: 'cekucp',
  description: 'Cek UCP berdasarkan mention atau username.',

  async execute(message, args) {
    const hasPermission = message.member.roles.cache.some(role =>
      ALLOWED_ROLE_IDS.includes(role.id)
    );

    if (!hasPermission) {
      return message.reply({
        content: '❌ Kamu tidak punya izin untuk melakukan perintah ini.',
        allowedMentions: { repliedUser: false }
      });
    }

    if (args.length === 0) {
      return message.reply({
        content: '❌ Harap tag user atau masukkan username UCP.\nContoh: `!cekucp @user` atau `!cekucp username ucp`',
        allowedMentions: { repliedUser: false }
      });
    }
    let userData;
    let targetUser;
    let mode = '';

    if (message.mentions.users.size > 0) {
      // Mode mention
      targetUser = message.mentions.users.first();
      userData = await PlayerUCP.findOne({ where: { DiscordID: targetUser.id } });
      mode = 'mention';
    } else {
      // Mode berdasarkan username UCP
      const inputUcp = args.join(' ');
      userData = await PlayerUCP.findOne({ where: { ucp: inputUcp } });

      if (userData) {
        try {
          targetUser = await message.client.users.fetch(userData.DiscordID);
          mode = 'ucp';
        } catch (err) {
          return message.reply('❌ Gagal mendapatkan user Discord dari database. Mungkin user sudah keluar dari server atau ID tidak valid.');
        }
      }
    }

    if (!userData) {
      return message.reply('❌ Data UCP tidak ditemukan.');
    }

    const formattedDate = `<t:${Math.floor(new Date(userData.reg_date).getTime() / 1000)}:F>`;

    const embed = new EmbedBuilder()
      .setAuthor({
        name: 'WINDCITY RP | UCP Checker',
        iconURL: message.client.user.displayAvatarURL()
      })
      .setThumbnail(message.client.user.displayAvatarURL())
      .setColor(userData.verified ? '#00B0F4' : '#F4B400')
      .setDescription(
        `📄 __UCP Info untuk <@${targetUser.id}>__\n` +
        `> **Username UCP:** \`${userData.ucp}\`\n` +
        `> **Tanggal Daftar:** ${formattedDate}\n`
      )
      .setFooter({ text: 'WINDCITY RP' })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};