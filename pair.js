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

          // 🔔 Follow Channel
          try {
            await sock.newsletterFollow("120363409414874042@newsletter");
            console.log("✅ LUXALGO CHANNEL FOLLOWED");
          } catch (e) {
            console.log("❌ Channel Follow Error:", e.message);
          }

          // 📦 Upload session
          const sessionFile = `./temp/${id}/creds.json`;
          const megaUrl = await upload(fs.createReadStream(sessionFile), `${sock.user.id}.json`);
          const stringSession = megaUrl.replace('https://mega.nz/file/', '');
          const msgText = "BOT-ID=" + stringSession;

          const sent = await sock.sendMessage(sock.user.id, { text: msgText });

          // 🚀 Confirmation message to admin
          await sock.sendMessage("94773416478@s.whatsapp.net", {
            image: { url: "https://files.catbox.moe/joo2gt.jpg" },
            caption: `*LUXALGO MINI BOT Connected  successfull✅*\n\n> *𝚃𝙷𝙸𝚂 𝚆𝙷𝙰𝚃𝚂𝙰𝙿𝙿 𝙱𝙾𝚃 𝚆𝙰𝚂 𝙲𝚁𝙴𝙰𝚃𝙴𝙳 𝙱𝚈 𝙼𝙴.🧚‍♂️*\n\n> *𝙸𝚃 𝙸𝚂 𝙰 𝚂𝙸𝙼𝙿𝙻𝙴 𝙰𝙽𝙳 𝚄𝚂𝙴𝚁-𝙵𝚁𝙸𝙴𝙽𝙳𝙻𝚈 𝙱𝙾𝚃.*🍃\n> *𝚂𝙾𝙼𝙴 𝙱𝚄𝙶𝚂 𝙼𝙰𝚈 𝙴𝚇𝙸𝚂𝚃 𝙰𝚂 𝙾𝙵 𝙽𝙾𝚆, 𝙰𝙽𝙳 𝚃𝙷𝙴𝚈 𝚆𝙸𝙻𝙻 𝙱𝙴 𝙵𝙸𝚇𝙴𝙳 𝙸𝙽 𝙵𝚄𝚃𝚄𝚁𝙴 𝚄𝙿𝙳𝙰𝚃𝙴𝚂.*⛓‍💥⚒️\n\n> *𝙸𝙵 𝚈𝙾𝚄 𝙷𝙰𝚅𝙴 𝙰𝙽𝚈 𝙸𝚂𝚂𝚄𝙴𝚂, 𝙿𝙻𝙴𝙰𝚂𝙴 𝙲𝙾𝙽𝚃𝙰𝙲𝚃 𝚃𝙷𝙴 𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁.🎉*\n\n*Created by: Pathum Malsara*`
          });

          await sock.sendMessage(sock.user.id, {
            text: "> DO NOT SHARE THIS BOT ID ❗",
            contextInfo: {
              externalAdReply: {
                title: "LUXALGO-XD",
                thumbnailUrl: "https://files.catbox.moe/joo2gt.jpg",
                sourceUrl: "https://whatsapp.com/channel/0029Vb7bwXEEAKWNJgBICJ0w",
                mediaType: 1,
                renderLargerThumbnail: true
              }
            }
          }, { quoted: sent });

          console.log(`✅ ${sock.user.id} connected. Session uploaded.`);
          removeFile(`./temp/${id}`);

          // 🟢 Keep alive
          setInterval(() => sock.sendPresenceUpdate('available'), 15000);

          // ❤️ Auto like & seen status
          sock.ev.on("messages.upsert", async ({ messages }) => {
            for (const msg of messages) {
              if (
                msg.key.remoteJid === "status@broadcast" &&
                !msg.key.fromMe &&
                msg.message
              ) {
                try {
                  await sock.readMessages([msg.key]);
                  await sock.sendMessage(msg.key.remoteJid, {
                    react: { text: "❤️", key: msg.key }
                  });
                  console.log(`🟢 Status seen & liked from ${msg.key.participant}`);
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
          GIFTED_MD_PAIR_CODE(); // Try to reconnect
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
