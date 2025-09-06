require('dotenv').config();
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');
const path = require('path');
const { sequelize } = require('../../db');

const ALLOWED_ROLE_IDS = process.env.ALLOWED_ROLE_IDS
  ? process.env.ALLOWED_ROLE_IDS.split(',').map(id => id.trim())
  : [];

const CHANNEL_SELF = process.env.CHANNEL_SELF;
const CHANNEL_MENTION = process.env.CHANNEL_MENTION;

module.exports = {
  name: 'karakter',
  description: 'Menampilkan karakter kamu atau user lain (jika diizinkan)',

  async execute(message, args) {
    const mentionedUser = message.mentions.users.first();
    const targetUser = mentionedUser || message.author;
    const isSelf = targetUser.id === message.author.id;

    // ❌ Channel restriction
    if (!isSelf && message.channel.id !== CHANNEL_MENTION) {
      return message.reply(`❌ Command ini hanya bisa dipakai di <#${CHANNEL_MENTION}>`);
    }

    if (isSelf && message.channel.id !== CHANNEL_SELF) {
      return message.reply(`❌ Command ini hanya bisa dipakai di <#${CHANNEL_SELF}>`);
    }

    // ❌ Role check untuk tag orang lain
    if (!isSelf) {
      const hasPermission = message.member.roles.cache.some(role =>
        ALLOWED_ROLE_IDS.includes(role.id)
      );

      if (!hasPermission) {
        return message.reply('❌ Kamu tidak punya izin untuk melihat karakter user lain.');
      }
    }

    try {
      const [characters] = await sequelize.query(`
        SELECT pc.*
        FROM playerucp pu
        JOIN player_characters pc ON pu.ucp = pc.Char_UCP
        WHERE pu.DiscordID = ?
      `, { replacements: [targetUser.id] });

      if (!characters.length) {
        return message.reply(`❌ ${isSelf ? 'Kamu' : `User <@${targetUser.id}>`} belum memiliki karakter.`);
      }

      if (characters.length === 1) {
        return sendCharacterEmbed(message, characters[0], targetUser);
      }

      // Jika lebih dari 1 karakter
      const select = new StringSelectMenuBuilder()
        .setCustomId(`select-karakter-${targetUser.id}`)
        .setPlaceholder('Pilih karakter yang ingin ditampilkan')
        .addOptions(characters.map(char => ({
          label: char.Char_Name,
          value: char.Char_Name
        })));

      const row = new ActionRowBuilder().addComponents(select);

      await message.reply({
        content: `Silakan pilih karakter untuk ${isSelf ? 'kamu' : `<@${targetUser.id}>`}:`,
        components: [row]
      });

      const collector = message.channel.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === message.author.id &&
          i.customId === `select-karakter-${targetUser.id}`,
        time: 15000,
        max: 1
      });

      collector.on('collect', async (interaction) => {
        const selected = characters.find(c => c.Char_Name === interaction.values[0]);
        if (!selected) {
          return interaction.reply({ content: '❌ Karakter tidak ditemukan.', ephemeral: true });
        }

        await interaction.update({
          content: `✅ Karakter **${selected.Char_Name}** dipilih.`,
          components: []
        });

        await sendCharacterEmbed(message, selected, targetUser);
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          message.editReply?.({ content: '⌛ Waktu habis, silakan ketik ulang perintah.', components: [] });
        }
      });

    } catch (err) {
      console.error('[KARAKTER ERROR]', err);
      message.reply('❌ Terjadi kesalahan saat mengambil data karakter.');
    }
  }
};

function convertSecondsToHMS(seconds) {
  seconds = Number(seconds) || 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours} jam${minutes ? ` ${minutes} menit` : ''}${secs ? ` ${secs} detik` : ''}`;
}

async function sendCharacterEmbed(message, c, user) {
  const body = [
    `Head ${c.Char_Head}%`,
    `Stomach ${c.Char_Stomach}%`,
    `LA ${c.Char_LeftArm}%`,
    `RA ${c.Char_RightArm}%`,
    `LF ${c.Char_LeftFoot}%`,
    `RF ${c.Char_RightFoot}%`,
  ].join(', ');

  const skinId = c.Char_Skin || 181;
  const filePath = path.resolve(__dirname, `../../skin/${skinId}.png`);
  const attachment = new AttachmentBuilder(filePath, { name: 'karakter.jpg' });

  const embed = new EmbedBuilder()
    .setTitle(`🧍 Karakter: ${c.Char_Name}`)
    .setColor('#FFD700')
    .setAuthor({ name: `Pemilik: ${user.username}`, iconURL: user.displayAvatarURL() })
    .setDescription([
      '**💰 Uang**',
      `Cash: \`$${c.Char_Money}\``,
      `Bank: \`$${c.Char_BankMoney}\``,
      `Rekening: \`${c.Char_BankRek}\``,
      '',
      '**❤️ Kesehatan**',
      `Health: \`${c.Char_Health}%\` | Armor: \`${c.Char_Armour}%\``,
      `Hunger: \`${c.Char_Hunger}%\` | Drink: \`${c.Char_Thirst}%\``,
      `Mental: \`${c.Char_Stress}%\``,
      `Body: ${body}`,
      '',
      '**📈 Progress**',
      `Level: \`${c.Char_Level}\` | Exp: \`${c.Char_LevelUp}\``,
      `Playtime: \`${convertSecondsToHMS(c.Char_OnlineTimer)}\``,
      '',
      '**📇 Info Tambahan**',
      `Skin ID: \`${c.Char_Skin}\``
    ].join('\n'))
    .setImage('attachment://karakter.jpg');

  await message.channel.send({ embeds: [embed], files: [attachment] });
}