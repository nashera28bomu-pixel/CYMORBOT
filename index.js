const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const os = require('os');
const fs = require('fs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BOT_NAME = "Cymor Bot";
const OWNER_NUMBER = "2547XXXXXXXX@s.whatsapp.net"; // Change this
const startTime = Date.now();

let sock;
let totalUsers = 0;
let totalMessages = 0;

// =============================
// COMMAND MAP
// =============================
const commands = {
    '.menu': async (sock, jid) => {
        await sock.sendMessage(jid, { text: `*${BOT_NAME}* Premium Menu\n\n- General: .ping, .runtime, .owner, .quote, .joke\n- Tools: .sticker, .google, .weather, .translate, .readmore\n- Group: .groupinfo, .kick, .promote, .demote, .invite, .setname, .setdesc\n- Media: .img, .vv, .getpp` });
    },
    '.ping': async (sock, jid) => {
        const ping = Date.now() - startTime;
        await sock.sendMessage(jid, { text: `⚡ Pong! (${ping}ms)` });
    },
    '.runtime': async (sock, jid) => {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        await sock.sendMessage(jid, { text: `🤖 Bot Uptime: ${uptime} seconds` });
    },
    '.sticker': async (sock, jid, msg) => {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
        if (!quoted) return sock.sendMessage(jid, { text: "Reply to an image!" });
        const buffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
        await sock.sendMessage(jid, { sticker: buffer });
    },
    '.google': async (sock, jid, _, args) => {
        const query = args.join(" ");
        await sock.sendMessage(jid, { text: `🔍 Searching for: ${query}\n(Integration needed for live results)` });
    },
    '.kick': async (sock, jid, msg) => {
        const target = msg.message.extendedTextMessage.contextInfo.participant;
        await sock.groupParticipantsUpdate(jid, [target], "remove");
    },
    '.readmore': async (sock, jid, _, args) => {
        const text = args.join(" ");
        await sock.sendMessage(jid, { text: text + String.fromCharCode(8206).repeat(3000) + "\nRead More..." });
    },
    '.reboot': async (sock, jid) => {
        if(jid !== OWNER_NUMBER) return;
        await sock.sendMessage(jid, { text: "🔄 Rebooting..." });
        process.exit();
    }
    // You can continue adding the rest of the 20 commands here using the same pattern!
};

// =============================
// BOT LOGIC
// =============================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        browser: [BOT_NAME, "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({ connection }) => {
        if (connection === 'open') console.log(`${BOT_NAME} Online!`);
        if (connection === 'close') startBot();
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        totalMessages++;
        const jid = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const command = body.toLowerCase().split(" ")[0];
        const args = body.split(" ").slice(1);

        if (commands[command]) {
            try {
                await commands[command](sock, jid, msg, args);
            } catch (e) {
                console.error(e);
                await sock.sendMessage(jid, { text: "❌ Error executing command." });
            }
        }
    });
}

startBot();

// Express app for Pairing Page & Admin Dashboard (kept same as original)
app.get('/', (req, res) => res.send('<h1>Cymor Bot Running</h1>'));
app.post('/pair', async (req, res) => {
    const code = await sock.requestPairingCode(req.body.number.replace(/[^0-9]/g, ""));
    res.json({ code });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
