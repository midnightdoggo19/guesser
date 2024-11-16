# Guesser
## Installation

### Clone the repository:

    git clone https://github.com/midnightdoggo19/guesser.git
    cd guesser

### Install dependencies:

    pip install -r ./python/requirements.txt
    npm install

Copy example.env and add your bot's information, and rename it to .env.

Run the bot:

    node main.js

## Usage
### Commands
    !archive - Exports the current channel as a .csv file for use in training the model.
    !retrain - Makes use of the exported .csv file to train the model.

### Guessing
In order to have the bot start guessing, just send a channel in a server the bot has access to! It'll process the message and try and guess who sent it.
