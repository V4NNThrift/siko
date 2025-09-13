const { SlashCommandBuilder } = require('discord.js');
const { performBackup, sendBackupToUser } = require('../../utils/backup');

const OWNER_ID = '714045397659811911';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backupnow')
    .setDescription('Menjalankan proses backup database secara manual.'),
  async execute(interaction) {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: '❌ Perintah ini hanya untuk owner.', ephemeral: true });
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
