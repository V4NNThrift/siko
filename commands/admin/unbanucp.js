const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PlayerUCP, PlayerBan, PlayerCharacter } = require('../../db');

const ADMIN_ROLE_ID = '1365274991846756419';
const ALLOWED_CHANNEL_ID = '1365274992786542600';
const LOG_CHANNEL_ID = '1414122219403083836';

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
    if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
        return interaction.reply({ content: `❌ Perintah ini hanya bisa digunakan di channel <#${ALLOWED_CHANNEL_ID}>.`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const ucpName = interaction.options.getString('ucp_name');
    const reason = interaction.options.getString('alasan');
    const adminDiscordUser = interaction.user;

    const adminUCP = await PlayerUCP.findOne({ where: { DiscordID: adminDiscordUser.id } });
    if (!adminUCP) {
      return interaction.editReply({ content: '❌ Akun admin Anda tidak ditemukan di database.' });
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
        .setAuthor({ name: adminUCP.ucp, iconURL: adminDiscordUser.displayAvatarURL() })
        .setDescription(`UCP **${ucpName}** telah di-unban.`)
        .addFields(
          { name: 'Admin', value: `<@${adminDiscordUser.id}> (\`${adminUCP.ucp}\`)`, inline: false },
          { name: 'Alasan', value: reason, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Ban & Unban Log' });

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }

      await interaction.editReply({ content: `✅ Berhasil melakukan unban pada UCP \`${ucpName}\`.` });

    } catch (error) {
      console.error('Failed to process unban:', error);
      await interaction.editReply({ content: '❌ Terjadi kesalahan saat memproses unban di database.' });
    }
  },
};
