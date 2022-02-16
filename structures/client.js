const Discord = require("discord.js");
const { Player } = require("discord-player");
const config = require("../config.js");
const fs = require("fs");
const { Lyrics } = require("@discord-player/extractor");
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');


class Client extends Discord.Client {
	constructor() {
		config.prefix = process.env.PREFIX || config.prefix;
		config.botToken = process.env.BOTTOKEN || config.botToken;
		config.clientId = process.env.CLIENTID || config.clientId;
		config.geniusApiToken = process.env.GENIUSAPITOKEN || config.geniusApiToken;

		super({	intents: [
			Discord.Intents.FLAGS.GUILDS,
			Discord.Intents.FLAGS.GUILD_MESSAGES,
			Discord.Intents.FLAGS.GUILD_VOICE_STATES
		]});

		this.commands = [];
		this.player = new Player(this);
		this.requiredVoicePermissions = [
            "VIEW_CHANNEL",
            "CONNECT",
            "SPEAK"
        ];
		this.requiredTextPermissions = [
			"VIEW_CHANNEL",
			"SEND_MESSAGES",
			"READ_MESSAGE_HISTORY",
			"ADD_REACTIONS",
			"EMBED_LINKS"
		];
		this.prefix = config.prefix;
		this.io = require("socket.io")(process.env.PORT || 3000, { cors: { origin: "*", methods: ["GET", "POST"] }});
		this.urlModule = require('url'); // Build-in node module
	}

	async init(token) {
		if(config.botToken === "BOT TOKEN HERE" || config.botToken === "" || !config.botToken)
			return console.error("--- ERROR: Bot token is empty! Make sure to fill this out in config.js");

		let count = 0;

		// commands
		const commandFiles = fs.readdirSync("./commands")
			.filter(file => file.endsWith(".js"));
		const commands = commandFiles.map(file => require(`../commands/${file}`));
		commands.forEach(cmd => {
			count++;
			this.commands.push(cmd);
		});
		console.log(`${count} commands loaded.`);
		count = 0;

		// slash commands
		if(config.clientId && config.clientId !== "") {
			const slashCommands = commands.map(cmd => ({
				name: cmd.name,
				description: cmd.description,
				options: cmd.options,
				defaultPermission: true
			}));
			const rest = new REST({ version: '9' }).setToken(config.botToken);
			await rest.put(Routes.applicationCommands(config.clientId), { body: slashCommands })
				.then(() => console.log('Global slash commands registered successfully.'))
				.catch(console.error);
		}
		
		// client events
		this.removeAllListeners();
		fs.readdirSync("./events")
			.filter(file => file.endsWith(".js"))
			.forEach(file => {
				count++;
				const event = require(`../events/${file}`);
				this.on(event.event, event.run.bind(null, this));
			});
		console.log(`${count} client events loaded.`);
		count = 0;

		// discord-player events
		fs.readdirSync("./events/player_events")
			.filter(file => file.endsWith(".js"))
			.forEach(file => {
				count++;
				const event = require(`../events/player_events/${file}`);
				this.player.on(event.event, event.run.bind(null, this.player))
			});
		console.log(`${count} player events loaded.`);

		// @discord-player/extractor lyrics
		this.lyrics = Lyrics.init(config.geniusApiToken);
		if(config.geniusApiToken === "GENIUS.COM CLIENT ACCESS TOKEN HERE" || config.geniusApiToken === "" || !config.geniusApiToken)
			console.log("No Genius API token provided. Lyrics feature might not work properly.");

		this.login(token);

		// socket-io events
		this.io.on('connection', socket => {
			console.log(`Socket connection detected : ${socket.id}`);

			// socket event handler
            		fs.readdirSync("./events/socket_events")
				.filter(file => file.endsWith(".js"))
				.forEach(file => {
					const event = require(`../events/socket_events/${file}`);
					socket.on(event.event, event.run.bind(null, this, socket, this.io));
				});
		})

		// Webplayer Check
		this.hasWebplayer = this.isUrl(process.env.WEBPLAYER) || this.isUrl(config.webplayer);

	}
	isUrl (str){
		try{
			const link = this.urlModule.parse(str);
			return (link.hostname === null) ? false : true;
		} catch (err){
			return false;
		}
	}
}

module.exports = Client;
