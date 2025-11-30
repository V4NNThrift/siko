const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Melihat latensi bot.'),
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true, ephemeral: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🏓 Pong!')
        .addFields(
            { name: 'Latensi Bot', value: `${latency}ms`, inline: true },
            { name: 'Latensi API', value: `${apiLatency}ms`, inline: true }
        );

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};
