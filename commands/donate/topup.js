const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const TOPUP_CHANNEL = process.env.TOPUP_CHANNEL;
const tagChannel = `<#${TOPUP_CHANNEL}>`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('topup')
    .setDescription('Tampilkan tombol untuk memulai topup'),

  async execute(interaction) {
    if (interaction.channelId !== TOPUP_CHANNEL) {
      return interaction.reply({
        content: `❌ Command ini hanya bisa digunakan di channel ${tagChannel}`,
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setAuthor({
        name: 'WINDCITY RP | Topup Produk',
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setColor('#00B0F4')
      .setDescription(
        "Kamu bisa membeli produk seperti kendaraan atau skin dengan pembayaran QRIS. Klik tombol di bawah untuk memulai." +
        "\n\n> Pastikan Untuk Keluar Kota Terlebih dahulu sebelum melakukan Topup\n\n"
      )
      .setFooter({ text: "WINDCITY RP" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("start_topup")
        .setLabel("Topup Sekarang")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("💰")
    );

    return interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
};