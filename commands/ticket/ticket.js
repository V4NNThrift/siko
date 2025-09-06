const {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder
} = require('discord.js');

const ALLOWED_CHANNEL_ID = process.env.TICKET_SUPPORT_CHANNEL;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Kirim tombol untuk membuat ticket'),

  async execute(interaction) {
    if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
      return interaction.reply({
        content: `❌ Command ini hanya bisa digunakan di <#${ALLOWED_CHANNEL_ID}>.`,
      });
    }

    const createButton = new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel('🎫 Buat Ticket')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(createButton);

    const embed = new EmbedBuilder()
      .setTitle('🎟️ Sistem Ticket')
      .setDescription('Klik tombol di bawah untuk membuat ticket baru. Tim support akan segera membantu Anda.')
      .setColor(0x2B2D31)
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setFooter({ text: `WINDCITY RP Ticket System`, iconURL: interaction.client.user.displayAvatarURL() });

    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
  }
};