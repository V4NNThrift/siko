const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PlayerUCP, PlayerBan, WarningLog, PlayerCharacter } = require('../../db');
const { Op } = require('sequelize');

const ADMIN_ROLE_ID = '1365274991846756419';
const ALLOWED_CHANNEL_ID = '1365274992786542600';
const LOG_CHANNEL_ID = '1414122219403083836';

// Helper function to get the highest admin level for a user
async function getHighestAdminLevel(ucp) {
    const characters = await PlayerCharacter.findAll({ where: { Char_UCP: ucp } });
    if (!characters.length) return 0;
    return Math.max(...characters.map(c => c.Char_Admin));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Membanned seorang pemain.')
    .addUserOption(option => option.setName('user').setDescription('User Discord yang akan di-ban.').setRequired(true))
    .addIntegerOption(option => option.setName('hari').setDescription('Durasi ban dalam hari (0 untuk permanen).').setRequired(true))
    .addStringOption(option => option.setName('alasan').setDescription('Alasan ban.').setRequired(true)),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ Anda tidak memiliki izin untuk menggunakan perintah ini.', ephemeral: true });
    }
    if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
        return interaction.reply({ content: `❌ Perintah ini hanya bisa digunakan di channel <#${ALLOWED_CHANNEL_ID}>.`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const days = interaction.options.getInteger('hari');
    const reason = interaction.options.getString('alasan');
    const adminDiscordUser = interaction.user;

    const adminUCP = await PlayerUCP.findOne({ where: { DiscordID: adminDiscordUser.id } });
    const targetUCP = await PlayerUCP.findOne({ where: { DiscordID: targetUser.id } });

    if (!adminUCP) {
      return interaction.editReply({ content: '❌ Akun admin Anda tidak ditemukan di database.' });
    }
    if (!targetUCP) {
      return interaction.editReply({ content: `❌ Akun UCP untuk ${targetUser.tag} tidak ditemukan.` });
    }

    const adminLevel = await getHighestAdminLevel(adminUCP.ucp);
    const targetLevel = await getHighestAdminLevel(targetUCP.ucp);

    if (adminLevel < 3) {
      return interaction.editReply({ content: '❌ Level admin Anda tidak mencukupi (membutuhkan level 3+).' });
    }
    if (adminLevel < 3 && (days > 10 || days < 0)) {
        return interaction.editReply({ content: '❌ Anda hanya dapat membanned selama 1 sampai 10 hari (atau 0 untuk permanen).' });
    }
    if (targetLevel > adminLevel) {
      return interaction.editReply({ content: '❌ Anda tidak dapat membanned admin yang levelnya lebih tinggi.' });
    }

    const banTime = days === 0 ? 0 : Math.floor(Date.now() / 1000) + (days * 86400);

    try {
      await PlayerBan.create({
        name: targetUCP.ucp,
        admin: adminUCP.ucp,
        reason: reason,
        ban_date: Math.floor(Date.now() / 1000),
        ban_expire: banTime,
      });

      const targetCharacters = await PlayerCharacter.findAll({ where: { Char_UCP: targetUCP.ucp } });
      if (targetCharacters.length > 0) {
        await WarningLog.create({
            pID: targetCharacters[0].pID,
            WarnType: 3,
            WarnTime: Math.floor(Date.now() / 1000),
            WarnSender: adminUCP.ucp,
            WarnReason: reason,
        });
      }

      const banType = days === 0 ? 'Permanen' : `${days} Hari`;
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🔨 Laporan Banned')
        .setAuthor({ name: adminUCP.ucp, iconURL: adminDiscordUser.displayAvatarURL() })
        .setDescription(`**<@${targetUser.id}>** (\`${targetUCP.ucp}\`) telah di-banned.`)
        .addFields(
          { name: 'Admin', value: `<@${adminDiscordUser.id}> (\`${adminUCP.ucp}\`)`, inline: false },
          { name: 'Durasi', value: banType, inline: true },
          { name: 'Alasan', value: reason, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Ban & Unban Log' });

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }

      await interaction.editReply({ content: `✅ Berhasil membanned **${targetUCP.ucp}**.` });

    } catch (error) {
      console.error('Failed to process ban:', error);
      await interaction.editReply({ content: '❌ Terjadi kesalahan saat memproses ban di database.' });
    }
  },
};
