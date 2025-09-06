require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

const { startWA } = require('./wa');
const { startStatusUpdater } = require('./commands/status/updateEmbed');
const handleOnIC = require('./commands/status/onic');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ['CHANNEL']
});

client.commands = new Collection();
client.handlers = [];
const prefix = '!';

// === Load slash commands & handlers ===
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);

    // Slash command
    if (command.data) {
      client.commands.set(command.data.name, command);
      console.log(`[\x1b[32mLOAD\x1b[0m] Loaded slash command: /${command.data.name} from ${folder}/${file}`);
    }

    // Interaction handler
    if (typeof command.handleInteraction === 'function') {
      client.handlers.push({
        handle: command.handleInteraction,
        folder,
        file
      });
      console.log(`[\x1b[32mLOAD\x1b[0m] Loaded handler: ${folder}/${file}`);
    }
  }
}

// === Slash & Interaction Handler ===
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      await interaction.reply({
        content: '[❌] Terjadi kesalahan saat menjalankan command.',
        ephemeral: true
      });
    }
    return;
  }

  for (const { handle, folder, file } of client.handlers) {
    try {
      if (folder === 'ticket' && !interaction.guild) continue;
      await handle(interaction);
    } catch (err) {
      console.error(`[❌] Interaction handler error in ${folder}/${file}:`, err);
    }
  }
});

// === Message Handler ===
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // ✅ Handler untuk "on ic" tanpa prefix
  handleOnIC(message);

  // ✅ Prefix command handler
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const commandPath = path.join(__dirname, 'commands', 'prefix', `${commandName}.js`);
  if (!fs.existsSync(commandPath)) return;

  try {
    const command = require(commandPath);
    await command.execute(message, args);
  } catch (error) {
    console.error(`[❌] Error executing !${commandName}:`, error);
    message.reply('❌ Terjadi kesalahan saat menjalankan command.');
  }
});

// === Bot Ready ===
client.once('ready', async () => {
  console.log(`[\x1b[36mONLINE\x1b[0m] Bot ready as ${client.user.tag}`);
  require('./deploy-commands'); // Register slash commands
  global.discordClient = client;

  try {
    await startWA(); // WhatsApp starter
  } catch (err) {
    console.error('WA Error:', err);
  }

  startStatusUpdater(client, process.env.STATUS_CHANNEL_ID);
});

client.login(process.env.TOKEN);