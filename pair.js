const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  Browsers,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const { upload } = require('./mega');

function removeFile(path) {
  if (fs.existsSync(path)) fs.rmSync(path, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
  const id = makeid();
  const num = (req.query.number || '').replace(/[^0-9]/g, '');
  if (!num) return res.status(400).json({ error: "Missing number" });

  async function GIFTED_MD_PAIR_CODE() {
    const { state, saveCreds } = await useMultiFileAuthState(`./temp/${id}`);

    try {
      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        logger: pino({ level: "fatal" }),
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        browser: Browsers.macOS("Safari")
      });

      sock.ev.on('creds.update', saveCreds);

      if (!sock.authState.creds.registered) {
        await delay(1500);
        const code = await sock.requestPairingCode(num);
        if (!res.headersSent) return res.send({ code });
      }

      sock.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;

        if (connection === "open") {
          await delay(3000);

          // Upload session to mega
          const sessionFile = `./temp/${id}/creds.json`;
          const megaUrl = await upload(fs.createReadStream(sessionFile), `${sock.user.id}.json`);
          const stringSession = megaUrl.replace('https://mega.nz/file/', '');
          const msgText = "PRINCE-MD=" + stringSession;

          const sent = await sock.sendMessage(sock.user.id, { text: msgText });
          await sock.sendMessage(sock.user.id, {
            text: "> DO NOT SHARE THIS SESSION ❗",
            contextInfo: {
              externalAdReply: {
                title: "PRINCE-MD",
                thumbnailUrl: "https://files.catbox.moe/vh2848.jpg",
                sourceUrl: "https://whatsapp.com/channel/0029VaxOi76K5cDJkV9UYR0Q",
                mediaType: 1,
                renderLargerThumbnail: true
              }
            }
          }, { quoted: sent });

          console.log(`✅ ${sock.user.id} connected. Session uploaded.`);
          removeFile(`./temp/${id}`);

          // 🟢 Keep bot alive
          setInterval(() => sock.sendPresenceUpdate('available'), 15000);

          // 🧠 Status seen + react
          sock.ev.on("messages.upsert", async ({ messages }) => {
            for (const msg of messages) {
              if (
                msg.key.remoteJid === "status@broadcast" &&
                !msg.key.fromMe &&
                msg.message
              ) {
                try {
                  await sock.readMessages([msg.key]); // Seen
                  await sock.sendMessage(msg.key.remoteJid, {
                    react: {
                      text: "❤️",
                      key: msg.key
                    }
                  }); // React
                  console.log(`🟢 Status seen & ❤️ from ${msg.key.participant}`);
                } catch (e) {
                  console.log("❌ Status Error:", e.message);
                }
              }
            }
          });
        }

        if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
          console.log("⚠️ Disconnected. Reconnecting...");
          await delay(3000);
          GIFTED_MD_PAIR_CODE(); // Reconnect loop
        }
      });

    } catch (err) {
      console.log("❌ Internal Error:", err.message);
      removeFile(`./temp/${id}`);
      if (!res.headersSent) return res.send({ code: "❗ Internal Error" });
    }
  }

  return await GIFTED_MD_PAIR_CODE();
});

module.exports = router;
