const {
    Client,
    Collection,
    Events,
    GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config()
const { logger } = require('./functions.js')
const { spawn } = require('child_process');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

client.once(Events.ClientReady, readyClient => {
	logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		}
	}
});

// The guessing bit
client.on('messageCreate', async (message) => {
    // AI guessing for each message
    // if (processedMessages >= process.env.MAXPROCESS) {
    //     logger.info('AI process limit reached, ignoring further messages.');
    //     return;
    // }

    if (message.author.bot || message.channel.id != process.env.WORKINGCHANNEL ||message.content.length < 1) return;

    logger.info(`Received message from ${message.author.username}: ${message.content}`);

    const predictor = spawn('python3', ['./predictor.py', message.content]);

    let prediction = '';
    predictor.stdout.on('data', data => {
        prediction += data.toString();
    });

    predictor.stderr.on('data', err => {
        logger.error(`Python script error: ${err.toString()}`);
    });

    predictor.on('close', async code => {
        if (code !== 0) {
                logger.error(`Python script exited with code ${code}`);
                await message.reply('**Sorry, there was an error making the prediction.**\nPlease try running \`/retrain\`. If that fails, please try \`/archive\`. If that still fails, please [open a GitHub issue](<https://github.com/midnightdoggo19/guesser/issues/new>).');
        }
        else {
                const predictedUser = prediction.trim();
                logger.info(`Predicted user for message "${message.content}": ${predictedUser}`);
                await message.reply(`The user most likely to have sent this message is: ${predictedUser}`);
        }
    });
});

client.login(process.env.TOKEN);