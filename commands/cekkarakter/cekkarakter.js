require('dotenv').config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');
const path = require('path');
const { sequelize } = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cekkarakter')
    .setDescription('Menampilkan informasi karakter berdasarkan nama.')
    .addStringOption(option =>
      option.setName('nama_karakter')
        .setDescription('Nama karakter In-Game (Gunakan _ untuk spasi).')
        .setRequired(true)),

  async execute(interaction) {
    const characterName = interaction.options.getString('nama_karakter');

    try {
      await interaction.deferReply();

      const query = `
        SELECT pc.*, pu.DiscordID
        FROM player_characters pc
        LEFT JOIN playerucp pu ON pc.Char_UCP = pu.ucp
        WHERE pc.Char_Name = ?
      `;
      const [results] = await sequelize.query(query, { replacements: [characterName] });

      if (results.length === 0) {
        return interaction.editReply(`❌ Karakter dengan nama **${characterName}** tidak ditemukan.`);
      }

      const characterData = results[0];
      let targetUser = null;

      if (characterData.DiscordID) {
        try {
          targetUser = await interaction.client.users.fetch(characterData.DiscordID);
        } catch (err) {
          console.log(`[CEKKARAKTER_FETCH_USER_WARN] Could not fetch user ${characterData.DiscordID} for character ${characterName}. They might not be in the server.`);
        }
      }

      // If user is not in the server, create a mock user object for display
      if (!targetUser) {
        targetUser = {
          username: 'Tidak Diketahui',
          displayAvatarURL: () => interaction.client.user.displayAvatarURL() // Default avatar
        };
      }

      await sendCharacterEmbed(interaction, characterData, targetUser);

    } catch (err) {
      console.error('[CEKKARAKTER_CMD_ERROR]', err);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Terjadi kesalahan saat mengambil data karakter.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Terjadi kesalahan saat mengambil data karakter.', ephemeral: true });
      }
    }
  }
};

function convertSecondsToHMS(seconds) {
  seconds = Number(seconds) || 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h} jam ${m} menit ${s} detik`;
}

async function sendCharacterEmbed(interaction, c, user) {
  const body = [
    `Head ${c.Char_Head}%`, `Stomach ${c.Char_Stomach}%`, `LA ${c.Char_LeftArm}%`,
    `RA ${c.Char_RightArm}%`, `LF ${c.Char_LeftFoot}%`, `RF ${c.Char_RightFoot}%`,
  ].join(', ');

  const skinId = c.Char_Skin || 181;
  const filePath = path.resolve(__dirname, `../../skin/${skinId}.png`);
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

  await interaction.editReply({ embeds: [embed], files: [attachment] });
}
