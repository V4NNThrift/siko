const { SlashCommandBuilder } = require('discord.js');
const cron = require('node-cron');
const scheduler = require('../../scheduler');

const OWNER_ID = '714045397659811911';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setschedule')
    .setDescription('Mengatur jadwal auto backup database (Owner only).')
    .addStringOption(option =>
      option.setName('cron_string')
        .setDescription('Format cron string (e.g., "0 */3 * * *")')
        .setRequired(true)),
  async execute(interaction) {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: '❌ Perintah ini hanya untuk owner.', ephemeral: true });
    }

    const newSchedule = interaction.options.getString('cron_string');

    if (!cron.validate(newSchedule)) {
      return interaction.reply({ content: `❌ Format cron string tidak valid: \`${newSchedule}\``, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await scheduler.reschedule(interaction.client, newSchedule);
      await interaction.editReply({ content: `✅ Jadwal auto backup berhasil diubah menjadi: \`${newSchedule}\`` });
    } catch (error) {
      console.error('[\x1b[31mCRON ERROR\x1b[0m] Failed to set new schedule:', error);
      await interaction.editReply({ content: '❌ Terjadi kesalahan saat mengatur jadwal baru.' });
    }
  },
};
