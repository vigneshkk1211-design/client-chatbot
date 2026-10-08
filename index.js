const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Vengalakshmi TV Agencies WhatsApp Bot is running smoothly!');
});

app.listen(PORT, () => {
    console.log(`Express server is running on port ${PORT}`);
});

async function connectToWhatsApp() {
    console.log('WhatsApp inaippu thodangugirathu...');

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ["Vengalakshmi Bot", "Chrome", "10.15.0"]
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('Keele ulla QR code-ai ungal WhatsApp-il scan seyyungal:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('Inaippu thundikkappattathu. Meendum inaikirathu...', shouldReconnect);

            if (shouldReconnect) {
                setTimeout(() => {
                    connectToWhatsApp();
                }, 3000);
            }
        } else if (connection === 'open') {
            console.log('✅ Vengalakshmi TV Agencies Bot vetrikaramaga inaikappattu thayaraga ullathu!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const sender = m.key.remoteJid;
        const text = (
            m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            m.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
            m.message.buttonsResponseMessage?.selectedButtonId ||
            ''
        ).trim().toLowerCase();

        if (sender.includes('@g.us')) return;

        // User munbu anuppiya text-il tamil letters irukiratha illa ivar enna language-il pesurar enru check seyyalam
        // Numbers mattum anuppinalum, atharku munbu enna pesinaro athu moolamo (or strict check)
        const isTamil = /[\u0B80-\u0BFF]/.test(text) || ['வணக்கம்', 'டீவி', 'பிரிட்ஜ்', 'ஏசி', 'மிக்ஸி', 'முகவரி', 'பேச', 'தமிழ்', 'டிவி', 'சமையல்', 'கடை', 'ஹாய்'].some(k => text.includes(k));

        async function sendImagesThenDescription(folderName, captionText) {
            try {
                const fullDirPath = path.join(__dirname, 'images', folderName);
                if (fs.existsSync(fullDirPath)) {
                    const files = fs.readdirSync(fullDirPath);
                    const imageFiles = files.filter(file => /\.(webp|jpg|jpeg|png|avif)$/i.test(file)).sort();

                    if (imageFiles.length > 0) {
                        for (let i = 0; i < imageFiles.length; i++) {
                            const imgPath = path.join(fullDirPath, imageFiles[i]);
                            if (fs.existsSync(imgPath)) {
                                try {
                                    const buffer = fs.readFileSync(imgPath);
                                    await sock.sendMessage(sender, { image: buffer });
                                    await new Promise(resolve => setTimeout(resolve, 1200));
                                } catch (imgErr) {
                                    console.error(`Padam anuppuvathil pizhai (${imageFiles[i]}):`, imgErr);
                                }
                            }
                        }
                        await sock.sendMessage(sender, { text: captionText });
                    } else {
                        await sock.sendMessage(sender, { text: captionText });
                    }
                } else {
                    await sock.sendMessage(sender, { text: captionText });
                }
            } catch (err) {
                console.error('Image sender error:', err);
            }
        }

        const isTV = text === '1' || text.includes('tv') || text.includes('television') || text.includes('entertainment') || text.includes('டீவி') || text.includes('தொலைக்காட்சி') || text.includes('டிவி');
        const isFridge = text === '2' || text.includes('fridge') || text.includes('fridges') || text.includes('freez') || text.includes('refrigerator') || text.includes('பிரிட்ஜ்') || text.includes('குளிர்சாதன');
        const isKitchen = text === '3' || text.includes('kitchen') || text.includes('gas') || text.includes('mixer') || text.includes('grinder') || text.includes('stove') || text.includes('சமையல்') || text.includes('மிக்ஸி');
        const isAC = text === '4' || text.includes('ac') || text.includes('air conditioner') || text.includes('cooling') || text.includes('fan') || text.includes('cooler') || text.includes('ஏசி') || text.includes('ஃபேன்');
        const isWashing = text === '5' || text.includes('washing') || text.includes('laundry') || text.includes('washer') || text.includes('machine') || text.includes('வாஷிங் மெஷின்');
        const isAddress = text === '6' || text.includes('address') || text.includes('location') || text.includes('map') || text.includes('shop') || text.includes('store') || text.includes('முகவரி') || text.includes('கடை');
        const isAdvisor = text === '7' || text.includes('advisor') || text.includes('call') || text.includes('human') || text.includes('talk') || text.includes('support') || text.includes('பேச');

        const isWelcomeTrigger = text === 'hi' || text === 'hello' || text === 'start' || text === 'menu' || text === 'வணக்கம்' || text === 'ஹாய்';

        if (isTV) {
            const caption = isTamil ?
                `📺 *பொழுதுபோக்கு சாதனங்கள் – புதிய வெங்கலலட்சுமி ஏஜென்சீஸ்*\n• ஸ்மார்ட் டிவிகள் & எல்இடி தொலைக்காட்சிகள் (32" முதல் 75\"+ அல்ட்ரா எச்டி 4K, QLED)\n• முன்னணி பிராண்டுகள்: Samsung, LG, Sony, TCL\n✅ 0% வட்டி எளிமையான ஈஎம்ஐ மற்றும் இலவச வீட்டு விநியோகம்\n📞 *தொடர்புக்கு:* +91 99762 45000` :
                `📺 *Entertainment Appliances – New Vengalakshmi Agencies*\n• Smart TVs & LED Televisions (32" to 75\"+ Ultra HD 4K, QLED)\n• Leading Brands: Samsung, LG, Sony, TCL\n✅ 0% Interest Easy EMIs & Free Home Delivery\n📞 *Contact:* +91 99762 45000`;

            await sendImagesThenDescription('Entertaiment', caption);
            return;
        }
        else if (isFridge) {
            const caption = isTamil ?
                `❄️ *குளிர்சாதன பெட்டிகள் – புதிய வெங்கலலட்சுமி ஏஜென்சீஸ்*\n• சிங்கிள் டோர், டபுள் டோர் & மல்டி-டோர் பிரிட்ஜ்கள்\n• முன்னணி பிராண்டுகள்: Samsung, LG, Whirlpool, Haier\n✅ எளிமையான ஈஎம்ஐ மற்றும் இலவச இன்ஸ்டாலேஷன் ஆதரவு\n📞 *தொடர்புக்கு:* +91 99762 45000` :
                `❄️ *Refrigerators – New Vengalakshmi Agencies*\n• Single Door, Double Door & Multi-Door Refrigerators\n• Leading Brands: Samsung, LG, Whirlpool, Haier\n✅ Easy EMI Options & Free Installation Support\n📞 *Contact:* +91 99762 45000`;

            await sendImagesThenDescription('Colling & Fridges', caption);
            return;
        }
        else if (isKitchen) {
            const caption = isTamil ?
                `🍳 *சமையலறை உபகரணங்கள் – புதிய வெங்கலலட்சுமி ஏஜென்சீஸ்*\n• ஹெவி டியூட்டி மிக்ஸி கிரைண்டர்கள் & வெட் கிரைண்டர்கள்\n• கிளாஸ் டாப் கேஸ் ஸ்டவ்கள் & இன்டக்ஷன் ஸ்டவ்கள்\n✅ சிறப்புப் பண்டிகை தள்ளுபடிகள் மற்றும் இலவச டெலிவரி\n📞 *தொடர்புக்கு:* +91 99762 45000` :
                `🍳 *Kitchen Appliances – New Vengalakshmi Agencies*\n• Heavy Duty Mixer Grinders & Wet Grinders\n• Glass Top Gas Stoves & Induction Stoves\n✅ Festive Discounts & Free Delivery\n📞 *Contact:* +91 99762 45000`;

            await sendImagesThenDescription('Kitchen Appliances', caption);
            return;
        }
        else if (isAC) {
            const caption = isTamil ?
                `❄️ *ஏசி மற்றும் குளிரூட்டும் சாதனங்கள் – புதிய வெங்கலலட்சுமி ஏஜென்சீஸ்*\n• இன்வெர்ட்டர் ஸ்பிளிட் ஏசிகள் (1 டன் முதல் 2 டன் - 3 & 5 ஸ்டார்)\n• அதிவேக சீலிங் ஃபேன் மற்றும் கூலர்கள்\n✅ எளிமையான ஈஎம்ஐ மற்றும் இலவச இன்ஸ்டாலேஷன் ஆதரவு\n📞 *தொடர்புக்கு:* +91 99762 45000` :
                `❄️ *AC & Cooling – New Vengalakshmi Agencies*\n• Inverter Split ACs (1 Ton to 2 Ton - 3 & 5 Star)\n• High-Speed Fans & Coolers\n✅ Easy EMI Options & Free Installation Support\n📞 *Contact:* +91 99762 45000`;

            await sendImagesThenDescription('Air Ciruculation & Fans', caption);
            return;
        }
        else if (isWashing) {
            const caption = isTamil ?
                `🧺 *துணி துவைக்கும் இயந்திரங்கள் – புதிய வெங்கலலட்சுமி ஏஜென்சீஸ்*\n• முழு தானியங்கி ஃப்ரண்ட் லோட் & டாப் லோட் வாஷிங் மெஷின்கள்\n• அரை தானியங்கி இரட்டை தொட்டி வாஷர்கள்\n✅ எளிமையான ஈஎம்ஐ மற்றும் நேரடி டெமோ சேவை\n📞 *தொடர்புக்கு:* +91 99762 45000` :
                `🧺 *Washing Machines – New Vengalakshmi Agencies*\n• Fully-Automatic Front Load & Top Load Washing Machines\n• Semi-Automatic Twin Tub Washers\n✅ Easy EMIs & Free Demonstration\n📞 *Contact:* +91 99762 45000`;

            await sendImagesThenDescription('Laundry & Washine machine', caption);
            return;
        }
        else if (isAddress) {
            const addressCaption = isTamil ?
                `📍 *புதிய வெங்கலலட்சுமி டிவி ஏஜென்சீஸ்*\nஎண். 50 / 50A, துருகம் சாலை, ராஜா நகர், ராஜா ராஜேஸ்வரி லாட்ஜ் அருகில், கள்ளக்குறிச்சி - 606202.\n📞 +91 99762 45000 / +91 97888 60021\n\n🗺️ *கூகுள் மேப் இருப்பிடம்:* https://maps.app.goo.gl/YourGoogleMapLinkHere` :
                `📍 *New Vengalakshmi TV Agencies*\nNo. 50 / 50A, Dhurugam Road, Raja Nagar, Near Raja Rajeshwari Lodge, Kallakurichi - 606202.\n📞 +91 99762 45000 / +91 97888 60021\n\n🗺️ *Google Maps Location:* https://maps.app.goo.gl/YourGoogleMapLinkHere`;

            const storePhotoPath = path.join(__dirname, 'images', 'store.jpg');
            if (fs.existsSync(storePhotoPath)) {
                try {
                    const storeBuffer = fs.readFileSync(storePhotoPath);
                    await sock.sendMessage(sender, { image: storeBuffer, caption: addressCaption });
                } catch (e) {
                    await sock.sendMessage(sender, { text: addressCaption });
                }
            } else {
                await sock.sendMessage(sender, { text: addressCaption });
            }
            return;
        }
        else if (isAdvisor) {
            const advText = isTamil ?
                `🗣️ எங்களின் விற்பனை ஆலோசகரிடம் உங்களை இணைக்கிறோம்... தயவுசெய்து எங்களை நேரடியாக +91 99762 45000 என்ற எண்ணിൽ அழைக்கவும்.` :
                `🗣️ Connecting you with our sales advisor... Please call us directly at +91 99762 45000.`;

            await sock.sendMessage(sender, { text: advText });
            return;
        }
        else if (isWelcomeTrigger || text.length > 0) {
            try {
                const welcomePath = path.join(__dirname, 'images', 'welcome.png');

                const welcomeText = isTamil ?
                    `🌟✨ *புதிய வெங்கலலட்சுமி ஏஜென்சீஸ், கள்ளக்குறிச்சி* ✨🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n\nபுதிய வெங்கலலட்சுமி ஏஜென்சீஸ், கள்ளக்குறிச்சிக்கு உங்களை அன்புடன் வரவேற்கிறோம்! 🌟\n\n🎉 1985 முதல் உங்கள் இல்லங்களுக்குத் தேவையான நவீன வசதிகளையும் மகிழ்ச்சியையும் வழங்கி 40 ஆண்டுகளுக்கு மேல் வெற்றிகரமாகச் சேவை வழங்கி வருகிறோம்!\n\n🤝 உங்களை எங்களது வாடிக்கையாளராக வரவேற்பதில் மிக்க மகிழ்ச்சி அடைகிறோம்.\n\n🛍️ முன்னணி பிராண்டுகளின் சிறந்த ஸ்மார்ட் டிவிகள், குளிர்சாதன பெட்டிகள், ஏசிகள் மற்றும் வீட்டு உபயோகப் பொருட்களைச் சிறந்த விலையில் பெற்றுக்கொள்ளுங்கள்.\n\n📍 எங்களது துருகம் சாலை ஷோரூமிற்கு நேரில் வருகை தாருங்கள் அல்லது எங்களது குழுவினரிடம் பேச இந்தச் செய்திக்குப் பதிலளிக்கவும்.\n\n👇 *பொருட்களைப் பார்க்க எண்களை அனுப்பவும் (Type Number):*\n\n1️⃣ 📺 டிவி & எல்இடி திரைகள் (Smart & 4K TVs)\n2️⃣ ❄️ குளிர்சாதன பெட்டிகள் (Fridges)\n3️⃣ 🍳 சமையலறை உபகரணங்கள் (Mixer, Grinder & Stoves)\n4️⃣ 🌬️ ஏசி & குளிர்விப்பான்கள் (AC & Fans)\n5️⃣ 🧺 வாஷிங் மெஷின் (Washing Machines)\n6️⃣ 📍 கடை முகவரி & லொகேஷன் பார்க்க\n7️⃣ 🗣️ எங்களின் நேரடி விற்பனை அதிகாரியிடம் பேச\n\n💬 *இனிய ஷாப்பிங்! உங்களுக்கு விருப்பமான எண்ணைத் (1-7) தட்டச்சு செய்யவும்!* 👇` :
                    `🌟✨ *New Vengalakshmi Agencies, Kallakurichi* ✨🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n\nWelcome to New Vengalakshmi Agencies, Kallakurichi! 🌟\n\n🎉 Celebrating over 40 years of bringing comfort to your home since 1985!\n\n🤝 We are delighted to have you with us.\n\n🛍️ Explore the best deals on top-tier smart TVs, refrigerators, ACs, and home appliances.\n\n📍 Visit us at Dhurugam Road or reply to this message to chat with our team.\n\n👇 *PLEASE CHOOSE A CATEGORY (Type Number):*\n\n1️⃣ 📺 TV & Entertainment (Smart TVs)\n2️⃣ ❄️ Refrigerators & Coolers (Fridges)\n3️⃣ 🍳 Kitchen & Small Appliances\n4️⃣ 🌬️ AC & Air Circulation (Fans)\n5️⃣ 🧺 Washing Machines & Laundry\n6️⃣ 📍 Store Address & Google Map\n7️⃣ 🗣️ Speak with our Sales Advisor\n\n💬 *Happy shopping! Type the number (1-7) to explore our collections!* 👇`;

                if (fs.existsSync(welcomePath)) {
                    try {
                        const buffer = fs.readFileSync(welcomePath);
                        await sock.sendMessage(sender, { image: buffer });
                    } catch (imgErr) {
                        console.error('Welcome image error:', imgErr);
                    }
                }

                await sock.sendMessage(sender, { text: welcomeText });
            } catch (e) {
                console.error('Menu anuppuvathil pizhai:', e);
            }
        }
    });
}

connectToWhatsApp();