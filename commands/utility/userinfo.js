const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Menampilkan informasi tentang seorang user.')
    .addUserOption(option => option.setName('user').setDescription('User yang ingin dilihat informasinya.')),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id);

    const embed = new EmbedBuilder()
      .setColor('#e67e22')
      .setTitle(`Informasi User: ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 Nama & Tag', value: user.tag, inline: true },
        { name: '🆔 ID User', value: user.id, inline: true },
        { name: '🤖 Apakah Bot?', value: user.bot ? 'Ya' : 'Tidak', inline: true },
        { name: '📆 Akun Dibuat', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '👋 Bergabung Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: '🎨 Warna Nama', value: member.displayHexColor, inline: true },
        { name: '🎭 Roles', value: member.roles.cache.map(r => r).join(' ') || 'Tidak ada' },
      )
      .setTimestamp()
      .setFooter({ text: `Diminta oleh ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  },
};
