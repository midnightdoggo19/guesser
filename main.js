require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
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
        new winston.transports.File({ filename: process.env.LOG || 'archive.log' }),
    ]
});

// Files
const DATASET_FILE = process.env.DATASET || 'dataset.csv';
const WORKING_CHANNEL = process.env.WORKINGCHANNEL;
const ANALYTICS_FILE = path.resolve(__dirname, './data/analytics.json');

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

// Remove entries for a specific user
function removeUserFromDataset(dataset, username) {
    const filteredDataset = dataset.filter(row => row.username !== username);
    logger.info(`Removed entries for user: ${username}. Remaining entries: ${filteredDataset.length}`);
    return filteredDataset;
}

// Generate analytics
function generateAnalytics(dataset) {
    //if (!Array.isArray(dataset)) {
    //    logger.error('Dataset is not an array. Cannot generate analytics.');
    //    return {};
    //}

    // Verify dataset structure
    const isValid = dataset.every(
        entry => typeof entry.Message === 'string' && typeof entry.username === 'string'
    );

    if (!isValid) {
        logger.error('Dataset entries are invalid. Ensure all entries have "Message" and "Username" fields.');
        return {};
    }

    const totalMessages = dataset.length;

    const messagesPerUser = dataset.reduce((acc, row) => {
        acc[row.username] = (acc[row.username] || 0) + 1;
        return acc;
    }, {});

    const wordCountPerUser = dataset.reduce((acc, row) => {
        const wordCount = row.Message.split(/\s+/).length;
        acc[row.username] = (acc[row.username] || 0) + wordCount;
        return acc;
    }, {});

    return {
        totalMessages,
        messagesPerUser,
        wordCountPerUser,
    };
}

// Save analytics to a file
function saveAnalytics(analytics) {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
    logger.info('Analytics generated and saved.');
}

function loadDataset() {
    const dataset = [];
    if (fs.existsSync(DATASET_FILE)) {
        if (!Array.isArray(dataset)) { throw new logger.error('Dataset is not an array.'); }
        const content = fs.readFileSync(DATASET_FILE, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        if (lines.length > 1) {
            const headers = lines[0].split(','); // Ensure valid headers
            const rows = lines.slice(1);
            rows.forEach(line => {
                const values = line.split(',');
                dataset.push({
                    [headers[0]]: values[0],
                    [headers[1]]: values[1],
                });
            });
        }
        logger.info(`Loaded dataset with ${dataset.length} entries.`);
    } else {
        logger.warn('Dataset file not found. Starting with an empty dataset.');
    }
    return dataset;
}

let dataset = loadDataset();

// Save Dataset
function saveDataset(dataset) {
    const csvWriter = createCsvWriter({
        path: DATASET_FILE,
        header: [
            { id: 'message', title: 'text' },
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
                messages.push({ Message: msg.content, username: msg.author.username });
            }
        });
        lastMessageId = fetched.last().id;
    }

    saveDataset(messages);
    return messages.length;
}

// Retrain Model
function retrainModel() {
    logger.info('Retraining model...');
    const python = spawn('python3', ['./train.py', DATASET_FILE]);

    python.stdout.on('data', data => logger.info(`Model Output: ${data.toString()}`));
    python.stderr.on('data', err => logger.error(`Model Error: ${err.toString()}`));

    python.on('close', code => {
        if (code === 0) logger.info('Model retrained successfully.');
        else logger.error(`Model retrain process exited with code ${code}.`);
    });
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id != process.env.WORKINGCHANNEL) return;

    if (message.content === '!savechannel') {
        randomReact(message)
        logger.info(`Archive command received in ${message.channel.name} from ${message.author.username}`);
        const count = await archiveMessages(message.channel);
        await message.reply(`Archived ${count} messages.`)
        yay(message)
    }
    else if (message.content === '!retrain') {
        randomReact(message)
        logger.info(`Retrain command received in channel ${message.channel.name} from ${message.author.username}`);
        retrainModel()
        yay(message)
    }
    else if (message.content.startsWith('!removeuser')) {
        const parts = message.content.split(' ');
        if (parts.length < 2) {
            await message.reply('Usage: `!removeuser <username>`');
            return;
        }

        const usernameToRemove = parts[1];
        const initialCount = dataset.length;

        logger.info(`Removeuser command received in channel ${message.channel.name} from ${message.author.username} (Removing ${usernameToRemove})`);

        dataset = dataset.filter(row => row.Username !== usernameToRemove);

        if (dataset.length < initialCount) {
            saveDataset(dataset);
            await message.reply(`Entries for user "${usernameToRemove}" have been removed.`);
        } else {
            await message.reply(`No entries found for user "${usernameToRemove}".`);
        }
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
            } else {
                 const predictedUser = prediction.trim();
                 logger.info(`Predicted user for message "${message.content}": ${predictedUser}`);
                 await message.reply(`The user most likely to have sent this message is: ${predictedUser}`);
            }
        });
    }
});

// Bot Ready Event
client.once('ready', () => {
    logger.info('Bot is online and ready.');
});

client.login(process.env.TOKEN);
