require('dotenv').config();
const {
  SlashCommandBuilder,
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
  data: new SlashCommandBuilder()
    .setName('karakter')
    .setDescription('Menampilkan karakter kamu atau user lain (jika diizinkan)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User yang ingin kamu lihat karakternya')
        .setRequired(false)),

  async execute(interaction) {
    const mentionedUser = interaction.options.getUser('user');
    const targetUser = mentionedUser || interaction.user;
    const isSelf = targetUser.id === interaction.user.id;

    // ❌ Channel restriction
    if (!isSelf && interaction.channel.id !== CHANNEL_MENTION) {
      return interaction.reply({ content: `❌ Command ini hanya bisa dipakai di <#${CHANNEL_MENTION}>`, ephemeral: true });
    }

    if (isSelf && interaction.channel.id !== CHANNEL_SELF) {
      return interaction.reply({ content: `❌ Command ini hanya bisa dipakai di <#${CHANNEL_SELF}>`, ephemeral: true });
    }

    // ❌ Role check untuk tag orang lain
    if (!isSelf) {
      const hasPermission = interaction.member.roles.cache.some(role =>
        ALLOWED_ROLE_IDS.includes(role.id)
      );

      if (!hasPermission) {
        return interaction.reply({ content: '❌ Kamu tidak punya izin untuk melihat karakter user lain.', ephemeral: true });
      }
    }

    try {
      await interaction.deferReply(); // Defer reply to avoid timeout

      const [characters] = await sequelize.query(`
        SELECT pc.*
        FROM playerucp pu
        JOIN player_characters pc ON pu.ucp = pc.Char_UCP
        WHERE pu.DiscordID = ?
      `, { replacements: [targetUser.id] });

      if (!characters.length) {
        return interaction.editReply(`❌ ${isSelf ? 'Kamu' : `User <@${targetUser.id}>`} belum memiliki karakter.`);
      }

      if (characters.length === 1) {
        return sendCharacterEmbed(interaction, characters[0], targetUser);
      }

      // Jika lebih dari 1 karakter
      const select = new StringSelectMenuBuilder()
        .setCustomId(`select-karakter-${targetUser.id}-${interaction.id}`)
        .setPlaceholder('Pilih karakter yang ingin ditampilkan')
        .addOptions(characters.map(char => ({
          label: char.Char_Name,
          value: char.Char_Name
        })));

      const row = new ActionRowBuilder().addComponents(select);

      const reply = await interaction.editReply({
        content: `Silakan pilih karakter untuk ${isSelf ? 'kamu' : `<@${targetUser.id}>`}:`,
        components: [row]
      });

      const collector = reply.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          i.customId === `select-karakter-${targetUser.id}-${interaction.id}`,
        time: 15000,
        max: 1
      });

      collector.on('collect', async (i) => {
        const selected = characters.find(c => c.Char_Name === i.values[0]);
        if (!selected) {
          return i.update({ content: '❌ Karakter tidak ditemukan.', components: [], ephemeral: true });
        }

        await i.update({
          content: `✅ Karakter **${selected.Char_Name}** dipilih.`,
          components: []
        });

        // Use interaction.channel.send to send a new message with the embed
        await sendCharacterEmbed(interaction, selected, targetUser, true);
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          interaction.editReply({ content: '⌛ Waktu habis, silakan ketik ulang perintah.', components: [] });
        }
      });

    } catch (err) {
      console.error('[KARAKTER ERROR]', err);
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
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours} jam${minutes ? ` ${minutes} menit` : ''}${secs ? ` ${secs} detik` : ''}`;
}

async function sendCharacterEmbed(interaction, c, user, useFollowUp = false) {
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

  const messagePayload = { embeds: [embed], files: [attachment] };

  if (useFollowUp) {
      await interaction.followUp(messagePayload);
  } else {
      await interaction.editReply(messagePayload);
  }
}
