const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');

function convertSecondsToHMS(seconds) {
  seconds = Number(seconds) || 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h} jam ${m} menit ${s} detik`;
}

async function sendCharacterEmbed(interaction, c, user, useFollowUp = false) {
  const body = [
    `Head ${c.Char_Head}%`, `Stomach ${c.Char_Stomach}%`, `LA ${c.Char_LeftArm}%`,
    `RA ${c.Char_RightArm}%`, `LF ${c.Char_LeftFoot}%`, `RF ${c.Char_RightFoot}%`,
  ].join(', ');

  const skinId = c.Char_Skin || 181;
  const filePath = path.resolve(__dirname, `../skin/${skinId}.png`);
  const attachment = new AttachmentBuilder(filePath, { name: 'karakter.jpg' });

  const embed = new EmbedBuilder()
    .setTitle(`🧍 Karakter: ${c.Char_Name}`)
    .setColor('#FFD700')
    .setAuthor({ name: `Pemilik: ${user.username}`, iconURL: user.displayAvatarURL() })
    .setDescription([
      '**💰 Uang**', `Cash: \`$${c.Char_Money}\``, `Bank: \`$${c.Char_BankMoney}\``, `Rekening: \`${c.Char_BankRek}\``, '',
      '**❤️ Kesehatan**', `Health: \`${c.Char_Health}%\` | Armor: \`${c.Char_Armour}%\``, `Hunger: \`${c.Char_Hunger}%\` | Drink: \`${c.Char_Thirst}%\``,
      `Mental: \`${c.Char_Stress}%\``, `Body: ${body}`, '',
      '**📈 Progress**', `Level: \`${c.Char_Level}\` | Exp: \`${c.Char_LevelUp}\``, `Playtime: \`${convertSecondsToHMS(c.Char_OnlineTimer)}\``, '',
      '**📇 Info Tambahan**', `Skin ID: \`${c.Char_Skin}\``
    ].join('\n'))
    .setImage('attachment://karakter.jpg');

  const payload = { embeds: [embed], files: [attachment], ephemeral: true };

  if (useFollowUp) {
    await interaction.followUp(payload);
  } else {
    if (interaction.deferred) {
        await interaction.editReply(payload);
    } else {
        await interaction.reply(payload);
    }
  }
}

module.exports = {
  convertSecondsToHMS,
  sendCharacterEmbed,
};
