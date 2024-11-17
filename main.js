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

// From the emoijs tab of the bot's dev portal page
const loadingEmojis = ['<a:loading2:1307386878609064030>', '<a:loading1:1307386865191620608>', '<a:loading:1307386851698409512>', '<a:loading3:1307386838947856474>', '<a:shakingeyes:1307349244717432954>'];

// Create Discord client
const client = new Client({
    intents: [ // Requires these to be enabled in the dev portal
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
    // Ignore messages not in valid channel or from bot itself
    if (message.author.bot) return;
    if (message.channel.id != process.env.WORKINGCHANNEL) return;

    // Log each received message
    logger.info(`Received message from ${message.author.username}: ${message.content}`);

    // Save to dataset file
    if (message.content.toLowerCase() === '!savechannel') {
        logger.info(`Archive command received in channel ${message.channel.name} by ${message.author.username}`);

        if (!message.channel.isTextBased()) {
            await message.reply('Please use this command in a text-based channel.');
            return;
        }

        await message.reply(`Archiving messages from ${message.channel.name}...`);

        try {
            let messages = [];
            let lastMessageId;

            // Fetch messages in chunks of 100 (can take some time for large channels)
            while (true) {
                const fetchedMessages = await message.channel.messages.fetch({ limit: 100, before: lastMessageId });
                if (fetchedMessages.size === 0) break;

                fetchedMessages.forEach(msg => {
                    if (!msg.author.bot) {
                        messages.push({
                            message: msg.content,
                            username: msg.author.username,
                        });
                    }
                });

                lastMessageId = fetchedMessages.last().id;
            }

            let writtenFile = process.env.DATASET

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

    else if (message.content.toLowerCase() === '!retrain') {
        logger.info(`Retrain command received in channel ${message.channel.name} by ${message.author.username}`);
        try {
            let loadingReaction = loadingEmojis[(Math.random() * loadingEmojis.length) | 0] // Pick a random emoji from the above array
            message.react(loadingReaction)

            const retrain = spawn('python3', ['./python/train.py']); // Run a python script to retrain the model
            retrain.stdout.on('data', data => {
                console.log(data.toString()); // Log output from python
            });
            retrain.on('close', async code => { // When python finishes
                await message.reply('Finished training model!')
                logger.info('Model training finished!')
            });
        }
        catch (error) {
            await message.reply('There was an error retraining the model.');
            await logger.error(`Error retraining model: ${error.message}`);
        }
    }

    else {
        // AI guessing for each message
        const predictor = spawn('python3', ['./python/predictor.py', message.content]);

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
                 await message.reply('**Sorry, there was an error making the prediction.**\nPlease try running \`!retrain\`. If that fails, please try \`!archive\`. If that fails, please (open a GitHub Issue)[<https://github.com/midnightdoggo19/guesser/issues/new>]');
            } else {
                 const predictedUser = prediction.trim();
                 logger.info(`Predicted user for message "${message.content}": ${predictedUser}`);
                 await message.reply(`The user most likely to have sent this message is: ${predictedUser}`);
            }
        });
    }
});

client.login(process.env.TOKEN);
