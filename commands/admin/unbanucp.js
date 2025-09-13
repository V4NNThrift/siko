const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PlayerUCP, PlayerBan } = require('../../db');

const ADMIN_ROLE_ID = '1365274991846756419';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unbanucp')
    .setDescription('Membuka ban seorang pemain berdasarkan nama UCP.')
    .addStringOption(option => option.setName('ucp_name').setDescription('Nama UCP yang akan di-unban.').setRequired(true))
    .addStringOption(option => option.setName('alasan').setDescription('Alasan unban.').setRequired(true)),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ Anda tidak memiliki izin untuk menggunakan perintah ini.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const ucpName = interaction.options.getString('ucp_name');
    const reason = interaction.options.getString('alasan');
    const adminUser = interaction.user;

    const adminAccount = await PlayerUCP.findOne({ where: { DiscordID: adminUser.id } });
    if (!adminAccount) {
      return interaction.editReply({ content: '❌ Akun admin Anda tidak ditemukan di database.' });
    }
     if (adminAccount.pAdmin < 3) {
      return interaction.editReply({ content: '❌ Level admin Anda tidak mencukupi (membutuhkan level 3+).' });
    }

    const bannedUcp = await PlayerBan.findOne({ where: { name: ucpName } });

    if (!bannedUcp) {
      return interaction.editReply({ content: `❌ Akun UCP \`${ucpName}\` tidak ditemukan dalam daftar ban.` });
    }

    try {
      await bannedUcp.destroy();

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Laporan Unbanned')
        .setDescription(`**${ucpName}** telah di-unban oleh **${adminAccount.ucp}**.`)
        .addFields(
          { name: 'Alasan', value: reason, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Ban & Unban Log' });

      await interaction.editReply({ content: `✅ Berhasil melakukan unban pada UCP \`${ucpName}\`.`, embeds: [embed] });

    } catch (error) {
      console.error('Failed to process unban:', error);
      await interaction.editReply({ content: '❌ Terjadi kesalahan saat memproses unban di database.' });
    }
  },
};
