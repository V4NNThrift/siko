const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PlayerUCP, PlayerBan, WarningLog } = require('../../db');

const ADMIN_ROLE_ID = '1365274991846756419';

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

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const days = interaction.options.getInteger('hari');
    const reason = interaction.options.getString('alasan');
    const adminUser = interaction.user;

    // --- Fetch accounts from DB ---
    const adminAccount = await PlayerUCP.findOne({ where: { DiscordID: adminUser.id } });
    const targetAccount = await PlayerUCP.findOne({ where: { DiscordID: targetUser.id } });

    if (!adminAccount) {
      return interaction.editReply({ content: '❌ Akun admin Anda tidak ditemukan di database.' });
    }
    if (!targetAccount) {
      return interaction.editReply({ content: `❌ Akun UCP untuk ${targetUser.tag} tidak ditemukan.` });
    }

    // --- Permission Checks ---
    if (adminAccount.pAdmin < 3) {
      return interaction.editReply({ content: '❌ Level admin Anda tidak mencukupi (membutuhkan level 3+).' });
    }
    if (adminAccount.pAdmin < 3 && (days > 10 || days < 0)) {
        return interaction.editReply({ content: '❌ Anda hanya dapat membanned selama 1 sampai 10 hari (atau 0 untuk permanen).' });
    }
    if (targetAccount.pAdmin > adminAccount.pAdmin) {
      return interaction.editReply({ content: '❌ Anda tidak dapat membanned admin yang levelnya lebih tinggi.' });
    }

    // --- Process Ban ---
    const banTime = days === 0 ? 0 : Math.floor(Date.now() / 1000) + (days * 86400);

    try {
      await PlayerBan.create({
        name: targetAccount.ucp,
        // ip and longip are not available from Discord, default values will be used.
        admin: adminAccount.ucp,
        reason: reason,
        ban_date: Math.floor(Date.now() / 1000),
        ban_expire: banTime,
      });

      await WarningLog.create({
        // pID is not directly available, assuming it's related to UCP account id.
        // This might need adjustment if pID maps to something else.
        // For now, we'll leave it as default.
        WarnType: 3, // 3 seems to be for bans based on the PAWN code
        WarnTime: Math.floor(Date.now() / 1000),
        WarnSender: adminAccount.ucp,
        WarnReason: reason,
      });

      const banType = days === 0 ? 'Permanen' : `${days} Hari`;
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🔨 Laporan Banned')
        .setDescription(`**${targetAccount.ucp}** telah di-banned oleh **${adminAccount.ucp}**.`)
        .addFields(
          { name: 'Durasi', value: banType, inline: true },
          { name: 'Alasan', value: reason, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Ban & Unban Log' });

      // In a real scenario, this would go to a specific log channel.
      // For now, we reply to the interaction.
      await interaction.editReply({ content: `✅ Berhasil membanned **${targetAccount.ucp}**.`, embeds: [embed] });

    } catch (error) {
      console.error('Failed to process ban:', error);
      await interaction.editReply({ content: '❌ Terjadi kesalahan saat memproses ban di database.' });
    }
  },
};
