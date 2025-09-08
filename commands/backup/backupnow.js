const { SlashCommandBuilder } = require('discord.js');
const { performBackup, sendBackupToUser } = require('../../utils/backup');

const STAFF_ROLE_IDS = (process.env.CEKUCP_ROLE_IDS || '').split(',').map(id => id.trim());

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backupnow')
    .setDescription('Menjalankan proses backup database secara manual.'),
  async execute(interaction) {
    const hasPermission = interaction.member.roles.cache.some(role => STAFF_ROLE_IDS.includes(role.id));
    if (!hasPermission) {
      return interaction.reply({ content: '❌ Anda tidak punya izin untuk melakukan perintah ini.', ephemeral: true });
    }

    await interaction.reply({ content: '⏳ Memulai proses backup manual... Ini mungkin memakan waktu beberapa saat.', ephemeral: true });

    try {
      const backupPath = await performBackup();
      await sendBackupToUser(interaction.client, backupPath);
      await interaction.followUp({ content: '✅ Backup manual berhasil diselesaikan dan telah dikirim ke DM owner.', ephemeral: true });
    } catch (error) {
      console.error('[\x1b[31mBACKUP ERROR\x1b[0m] Manual backup failed:', error);
      await interaction.followUp({ content: '❌ Terjadi kesalahan saat melakukan backup manual.', ephemeral: true });
    }
  },
};
