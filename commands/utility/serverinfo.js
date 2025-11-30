const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Menampilkan informasi tentang server ini.'),

  async execute(interaction) {
    const guild = interaction.guild;
    await guild.members.fetch(); // Ensure all members are cached

    const owner = await guild.fetchOwner();

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Informasi Server: ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '👑 Pemilik Server', value: owner.user.tag, inline: true },
        { name: '📆 Tanggal Dibuat', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
        { name: '🆔 ID Server', value: guild.id, inline: true },
        { name: '👥 Total Member', value: `${guild.memberCount}`, inline: true },
        { name: '👤 Manusia', value: `${guild.members.cache.filter(member => !member.user.bot).size}`, inline: true },
        { name: '🤖 Bot', value: `${guild.members.cache.filter(member => member.user.bot).size}`, inline: true },
        { name: '🎭 Jumlah Role', value: `${guild.roles.cache.size}`, inline: true },
        { name: '💬 Jumlah Channel', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🚀 Level Boost', value: `${guild.premiumTier} (Boosters: ${guild.premiumSubscriptionCount || 0})`, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: `Diminta oleh ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  },
};
