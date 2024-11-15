require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { spawn } = require('child_process');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const winston = require('winston');

// Setup Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: process.env.LOG }),
    ]
});

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.once('ready', () => {
    logger.info('Bot is online and ready to operate!');
});

// Listen to all messages
client.on('messageCreate', async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Log each received message
    logger.info(`Received message from ${message.author.username}: ${message.content}`);

    // Archive Trigger
    if (message.content.toLowerCase() === '!archive') {
        logger.info(`Archive command received in channel ${message.channel.name} by ${message.author.username}`);

        if (!message.channel.isTextBased()) {
            await message.reply('Please use this command in a text-based channel.');
            return;
        }

        await message.reply(`Archiving messages from ${message.channel.name}...`);

        try {
            let messages = [];
            let lastMessageId;

            // Fetch messages in chunks of 100
            while (true) {
                const fetchedMessages = await message.channel.messages.fetch({ limit: 100, before: lastMessageId });
                if (fetchedMessages.size === 0) break;

                fetchedMessages.forEach(msg => {
                    messages.push({
                        message: msg.content,
                        username: msg.author.username,
                    });
                });

                lastMessageId = fetchedMessages.last().id;
            }

            let writtenFile = `dataset.csv`

            // Create CSV Writer
            const csvWriter = createCsvWriter({
                path: writtenFile,
                header: [
                    { id: 'message', title: 'text' },
                    { id: 'username', title: 'username' },
                ]
            });

            // Write to CSV
            await csvWriter.writeRecords(messages);
            logger.info(`Archived ${messages.length} messages from channel ${message.channel.name}`);

            // Notify user
            await message.reply({
                content: 'Messages archived successfully!',
                files: [{ attachment: writtenFile }]
            });
        } catch (error) {
            logger.error(`Error archiving messages: ${error.message}`);
            await message.reply('There was an error archiving messages.');
        }
        return;
    }

    // AI Guessing for Each Message
    const python = spawn('python3', ['predictor.py', message.content]);

    let prediction = '';
    python.stdout.on('data', data => {
        prediction += data.toString();
    });

    python.stderr.on('data', err => {
        logger.error(`Python script error: ${err.toString()}`);
    });

    python.on('close', async code => {
        if (code !== 0) {
            logger.error(`Python script exited with code ${code}`);
            await message.reply('There was an error making the prediction.');
        } else {
            const predictedUser = prediction.trim();
            logger.info(`Predicted user for message "${message.content}": ${predictedUser}`);
            await message.reply(`The user most likely to have sent this message is: ${predictedUser}`);
        }
    });
});

client.login(process.env.TOKEN);
