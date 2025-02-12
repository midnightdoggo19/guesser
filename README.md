# Guesser
Guesser is a Discord bot that can download a channel and train an AI model on it in order to guess which user sent a message.

## Installation

### Clone the repository:

    git clone https://github.com/midnightdoggo19/guesser.git
    cd guesser

### Install dependencies:

    pip install -r requirements.txt
    npm install

#### Copy example.env and add your bot's information, and rename it to ".env". This includes:
<li>TOKEN- Your bot token</li>
<li>ID- Your bot ID</li>
<li>LOG- The file to log to (default: guess.log)</li>
<li>DATASET- Used by main.js and train.py as the csv to save the channel text & usernames too</li>
<li>WORKINGCHANNEL- The channel the bot should respond in</li>
<li>EMOJIS - emojis to be used as "thinking" reactions</li>
<li>LOGLEVEL - how much the logs should say</li>

##### Run the bot:

    npm start

## Usage
### Commands
    /archive - Exports the current channel as a .csv file for use in training the model.
    /retrain - Makes use of the exported .csv file to train the model.
    /remove - Removes a user from the dataset.
    /ping - Ping the bot

### Guessing
In order to have the bot start guessing, send a message in the channel defined in `.env`! It'll process the message and try and guess who sent it.
