require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const winston = require('winston');
const csv = require('csv-parser');

// Setup Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: process.env.LOG || 'archive.log' }),
    ]
});

// Files
const DATASET_FILE = process.env.DATASET || 'dataset.csv';
const WORKING_CHANNEL = process.env.WORKINGCHANNEL;

let processedMessages = 0; // Tracks processed messages
const AI_PROCESS_LIMIT = process.env.MAXPROCESS; // Maximum messages to process

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// From the emoijs tab of the bot's dev portal page
const loadingEmojis = ['<a:loading2:1307386878609064030>', '<a:loading1:1307386865191620608>', '<a:loading:1307386851698409512>', '<a:loading3:1307386838947856474>', '<a:shakingeyes:1307349244717432954>'];

function randomReact (message) {
    let loadingReaction = loadingEmojis[(Math.random() * loadingEmojis.length) | 0] // Pick a random emoji from the above array
    message.react(loadingReaction)
}

function yay (yaymessage) {
    yaymessage.react('<:check:1307855194930942033>')
}

async function workingChannelName() {
    let channel = client.channels.cache.get(process.env.WORKINGCHANNEL);

    if (!channel) {
        try {
            channel = await client.channels.fetch(process.env.WORKINGCHANNEL);
        } catch (error) {
            console.error('Error fetching the channel:', error);
            return null;
        }
    }

    return channel ? channel.name : null;
}

// Remove entries for a specific user
function removeUserFromDataset(dataset, username) {
    const filteredDataset = dataset.filter(row => row.username !== username);

    dataset = dataset.filter(row => {
        if (!row || !row.Username || !row.Message) {
            console.warn('Skipping malformed row:', row);
            return true; // Keep malformed rows, only exclude matching users
        }
        return row.Username.trim() !== usernameToRemove;
    });


    logger.info(`Removed entries for user: ${username}. Remaining entries: ${filteredDataset.length}`);
    return filteredDataset;
}

function loadDataset() {
    const dataset = [];
    if (fs.existsSync(DATASET_FILE)) {
        fs.createReadStream(DATASET_FILE)
            .pipe(csv())
            .on('data', (row) => {
                if (row.text && row.username) {
                    dataset.push({ text: row.text, username: row.username });
                } // else {
                    // console.warn('Malformed row:', row);
                // }
            })
            .on('end', () => logger.info(`Dataset loaded with ${dataset.length} entries.`));
    } else {
        logger.warn('Dataset file not found. Starting with an empty dataset.');
    }
    return dataset;
}

let dataset = loadDataset();

function saveDataset(dataset) {
    const csvWriter = createCsvWriter({
        path: DATASET_FILE,
        header: [
            { id: 'text', title: 'text' },
            { id: 'username', title: 'username' },
        ],
    });
    csvWriter.writeRecords(dataset).then(() => logger.info('Dataset saved successfully.'));
}

// Archive Messages
async function archiveMessages(channel) {
    let messages = [];
    let lastMessageId;

    while (true) {
        const fetched = await channel.messages.fetch({ limit: 100, before: lastMessageId });
        if (fetched.size === 0) break;

        fetched.forEach(msg => {
            if (!msg.author.bot) {
                messages.push({ text: msg.content, username: msg.author.username });
            }
        });
        lastMessageId = fetched.last().id;
    }

    saveDataset(messages);
    return messages.length;
}

// Retrain Model
async function retrainModel (reactmessage) {
    logger.info('Retraining model...');
    const python = spawn('python3', ['./train.py', DATASET_FILE]);

    python.stdout.on('data', data => console.log(`Model Output: ${data.toString()}`));
    python.stderr.on('data', err => console.log(`Model Error: ${err.toString()}`));

    python.on('close', code => {
        if (code === 0) { logger.info('Model retrained successfully.'); yay(reactmessage); }
        else { logger.error(`Model retrain process exited with code ${code}.`); }
    });
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id != process.env.WORKINGCHANNEL) return;

    if (message.content.toLowerCase() === '!savechannel') {
        randomReact(message)
        logger.info(`Archive command received in ${message.channel.name} from ${message.author.username}`);
        const count = await archiveMessages(message.channel);
        await message.reply(`Archived ${count} messages.`).then( yay(message) );
        return;
    }
    else if (message.content.toLowerCase() === '!retrain') {
        randomReact(message)
        logger.info(`Retrain command received in channel ${message.channel.name} from ${message.author.username}`);
        await retrainModel(message);
        return;
    }
    else if (message.content.startsWith('!removeuser')) {
        const parts = message.content.split(' ');
        if (parts.length < 2) {
            await message.reply('Usage: `!removeuser <username>`');
            return;
        }

        const usernameToRemove = parts[1].trim();
        console.log(`Attempting to remove user: "${usernameToRemove}"`);

        const initialCount = dataset.length;

        dataset = dataset.filter(row => {
            if (!row || !row.username || !row.text) {
                console.warn('Skipping malformed row:', row);
                return true;
            }
            return row.username.trim() !== usernameToRemove;
        });

        const removedCount = initialCount - dataset.length;

        if (removedCount > 0) {
            saveDataset(dataset);
            await message.reply(`Removed ${removedCount} entries for user "${usernameToRemove}".`);
            yay(message)
        } else {
            await message.reply(`No entries found for user "${usernameToRemove}".`);
        }
        return;
    }
    else {
        // AI guessing for each message
        if (processedMessages >= AI_PROCESS_LIMIT) {
            logger.info('AI process limit reached, ignoring further messages.');
            return;
        }

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
                 await message.reply('**Sorry, there was an error making the prediction.**\nPlease try running \`!retrain\`. If that fails, please try \`!savechannel\`. If that fails, please [open a GitHub issue](<https://github.com/midnightdoggo19/guesser/issues/new>).');
            }
            else {
                 const predictedUser = prediction.trim();
                 logger.info(`Predicted user for message "${message.content}": ${predictedUser}`);
                 await message.reply(`The user most likely to have sent this message is: ${predictedUser}`);
            }
        });
    }
});

client.on('error', (error) => {
    console.log(`error: ${error}`);
});

// Bot Ready Event
client.once('ready', () => {
   logger.info('Ready!');
   workingChannelName().then(name => { logger.info(`Running in channel: ${name}`) });
});

client.login(process.env.TOKEN);
