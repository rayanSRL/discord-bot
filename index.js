
const {
    Client,
    GatewayIntentBits,
    Partials,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const SALON_NOTATION_ID = '1522641516689100921'; // clic droit sur le salon > Copier l'identifiant


// Regex simple pour détecter un lien (http/https)
const REGEX_LIEN = /(https?:\/\/[^\s]+)/i;

// Stockage en mémoire des votes : Map<messageId, Map<userId, note>>
const votes = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
});

client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
});

// Menu déroulant : "Ne pas voter" puis les notes de 0 à 10
function construireMenu(messageId) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`note_${messageId}`)
        .setPlaceholder('Choisis une note')
        .addOptions(
            { label: 'Ne pas voter', value: 'abstain', emoji: '🚫' },
            ...Array.from({ length: 11 }, (_, note) => ({
                label: `${note}`,
                value: `${note}`,
            }))
        );

    return new ActionRowBuilder().addComponents(menu);
}

// Détermine une couleur (embed + emoji) selon la moyenne : rouge / orange / vert
function couleurSelonNote(moyenne) {
    if (moyenne === null) return { embed: 0x2b2d31, plein: '⬜' };
    if (moyenne < 4) return { embed: 0xed4245, plein: '🟥' };
    if (moyenne < 7) return { embed: 0xfee75c, plein: '🟨' };
    return { embed: 0x57f287, plein: '🟩' };
}

// Barre de progression colorée (10 segments)
function barreProgression(moyenne) {
    const { plein } = couleurSelonNote(moyenne);
    if (moyenne === null) return '⬛'.repeat(10);
    const remplis = Math.round((moyenne / 10) * 10);
    return plein.repeat(remplis) + '⬛'.repeat(10 - remplis);
}

// Embed simplifié : juste la moyenne, le nombre de votes, une barre visuelle
function construireEmbed(messageId) {
    const votesMessage = votes.get(messageId) || new Map();
    const totalVotes = votesMessage.size;

    let somme = 0;
    for (const note of votesMessage.values()) somme += note;
    const moyenne = totalVotes > 0 ? somme / totalVotes : null;
    const moyenneAffichee = moyenne !== null ? moyenne.toFixed(1) : '—';
    const couleur = couleurSelonNote(moyenne).embed;

    return new EmbedBuilder()
        .setColor(couleur)
        .setDescription(
            `${barreProgression(moyenne)}\n` +
            `**${moyenneAffichee}** / 10  ·  ${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`
        );
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== SALON_NOTATION_ID) return;
    if (!REGEX_LIEN.test(message.content)) return;

    try {
        votes.set(message.id, new Map());

        const embed = construireEmbed(message.id);
        const menu = construireMenu(message.id);

        // Envoie un nouveau message dans le salon, sans répondre/citer le message original
        await message.channel.send({
            embeds: [embed],
            components: [menu],
        });
    } catch (err) {
        console.error('Erreur lors de la création du vote :', err);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('note_')) return;

    const messageId = interaction.customId.replace('note_', '');
    const valeur = interaction.values[0];

    if (!votes.has(messageId)) {
        votes.set(messageId, new Map());
    }

    const votesMessage = votes.get(messageId);

    if (valeur === 'abstain') {
        // L'utilisateur retire son vote (ou choisit de ne pas voter)
        votesMessage.delete(interaction.user.id);
    } else {
        const note = parseInt(valeur, 10);
        votesMessage.set(interaction.user.id, note);
    }

    const embed = construireEmbed(messageId);
    await interaction.update({ embeds: [embed] });
});

client.login(TOKEN);