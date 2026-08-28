'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const {
    Client,
    LocalAuth
} = require('whatsapp-web.js');


// ============================================================
// SETTINGS
// ============================================================

const CHROMIUM_PATH =
    process.env.CHROMIUM_PATH ||
    '/data/data/com.termux/files/usr/bin/chromium-browser';

const MEMORY_FILE =
    path.join(__dirname, 'memory.json');

const MAX_HISTORY = 10;
const COOLDOWN_MS = 1800;


// ============================================================
// MEMORY
// ============================================================

let memory = {};

function loadMemory() {

    try {

        if (fs.existsSync(MEMORY_FILE)) {

            memory = JSON.parse(
                fs.readFileSync(
                    MEMORY_FILE,
                    'utf8'
                )
            );

            console.log('🧠 Memory loaded.');

        } else {

            memory = {};
            saveMemory();

            console.log('🧠 Memory created.');
        }

    } catch (error) {

        console.log(
            '⚠️ Memory load error:',
            error.message
        );

        memory = {};
    }
}


function saveMemory() {

    try {

        fs.writeFileSync(
            MEMORY_FILE,
            JSON.stringify(
                memory,
                null,
                2
            ),
            'utf8'
        );

    } catch (error) {

        console.log(
            '⚠️ Memory save error:',
            error.message
        );
    }
}


function getMemory(chatId) {

    if (!memory[chatId]) {

        memory[chatId] = {
            history: [],
            lastIntent: null,
            lastUserMessage: null,
            lastBotMessage: null,
            updatedAt: Date.now()
        };
    }

    return memory[chatId];
}


function addHistory(
    chatId,
    role,
    text,
    intent
) {

    const chat =
        getMemory(chatId);

    chat.history.push({
        role: role,
        text: text,
        intent: intent,
        time: Date.now()
    });

    if (
        chat.history.length >
        MAX_HISTORY
    ) {

        chat.history =
            chat.history.slice(
                -MAX_HISTORY
            );
    }

    if (role === 'user') {

        chat.lastUserMessage = text;
        chat.lastIntent = intent;

    } else {

        chat.lastBotMessage = text;
    }

    chat.updatedAt = Date.now();

    saveMemory();
}


// ============================================================
// CLIENT
// ============================================================

const client = new Client({

    authStrategy: new LocalAuth({
        clientId: 'friendly-context-bot'
    }),

    puppeteer: {

        executablePath: CHROMIUM_PATH,

        headless: true,

        args: [

            '--no-sandbox',

            '--disable-setuid-sandbox',

            '--disable-dev-shm-usage',

            '--disable-gpu',

            '--no-first-run',

            '--no-zygote',

            '--disable-extensions',

            '--disable-background-networking',

            '--disable-background-timer-throttling',

            '--disable-renderer-backgrounding'

        ]
    }
});


// ============================================================
// STATE
// ============================================================

const processedMessages =
    new Set();

const cooldown =
    new Map();


// ============================================================
// HELPERS
// ============================================================

function normalize(text = '') {

    return text
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[!?.,،।]+/g, ' ')
        .replace(/\s+/g, ' ');
}


function containsAny(
    text,
    words
) {

    return words.some(
        word =>
            text.includes(word)
    );
}


function random(list) {

    return list[
        Math.floor(
            Math.random() *
            list.length
        )
    ];
}


function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(resolve, ms)
    );
}


function isCooldown(chatId) {

    const last =
        cooldown.get(chatId);

    if (!last) {
        return false;
    }

    return (
        Date.now() - last <
        COOLDOWN_MS
    );
}


function setCooldown(chatId) {

    cooldown.set(
        chatId,
        Date.now()
    );
}


function getTime() {

    return new Intl.DateTimeFormat(
        'bn-BD',
        {
            timeZone: 'Asia/Dhaka',
            dateStyle: 'full',
            timeStyle: 'medium'
        }
    ).format(new Date());
}


// ============================================================
// INTENT DETECTION
// ============================================================

function detectIntent(message) {

    const text =
        normalize(message);


    // Commands
    if (
        text === '/help' ||
        text === 'help'
    ) {
        return 'help';
    }


    if (
        text === '/ping' ||
        text === 'ping'
    ) {
        return 'ping';
    }


    if (
        text === '/time' ||
        text === 'time'
    ) {
        return 'time';
    }


    if (
        text === '/id' ||
        text === 'id'
    ) {
        return 'id';
    }


    if (
        text === '/clear' ||
        text === 'clear'
    ) {
        return 'clear';
    }


    // Greeting
    if (
        containsAny(text, [

            'হ্যালো',
            'হেলো',
            'হাই',
            'hello',
            'hi',
            'hey',
            'সালাম',
            'আসসালামু আলাইকুম',
            'assalamu alaikum'

        ])
    ) {
        return 'greeting';
    }


    // How are you
    if (
        containsAny(text, [

            'কেমন আছো',
            'কেমন আছ',
            'কেমন আছেন',
            'কেমন আছিস',

            'ভালো আছো',
            'ভাল আছো',

            'kemon acho',
            'kemon aso',
            'kemon achis',

            'how are you'

        ])
    ) {
        return 'how_are_you';
    }


    // Activity
    if (
        containsAny(text, [

            'কি করো',
            'কী করো',
            'কি করছ',
            'কী করছ',
            'কি করতেছ',
            'কী করতেছ',
            'কি করতেছিস',
            'কী করতেছিস',

            'কি করছেন',
            'কী করছেন',

            'koro ki',
            'korcho ki',
            'ki koros',
            'ki korchis',

            'what are you doing'

        ])
    ) {
        return 'activity';
    }


    // Location
    if (
        containsAny(text, [

            'কোথায় আছ',
            'কোথায় আছ',
            'কই আছ',
            'কই আছিস',

            'kothay acho',
            'kothay achis',
            'koi acho',

            'where are you'

        ])
    ) {
        return 'location';
    }


    // Busy
    if (
        containsAny(text, [

            'ব্যস্ত নাকি',
            'ব্যস্ত আছ',
            'ব্যস্ত আছিস',
            'ফ্রি আছ',
            'ফ্রি আছিস',
            'সময় আছে',
            'সময় আছে',

            'busy',
            'free acho',
            'free achis'

        ])
    ) {
        return 'availability';
    }


    // Question permission
    if (
        containsAny(text, [

            'একটা কথা বলি',
            'একটা কথা বলবো',
            'একটা কথা বলব',
            'কিছু বলি',
            'একটা প্রশ্ন করি',

            'ekta kotha boli',
            'can i ask'

        ])
    ) {
        return 'permission';
    }


    // Food
    if (
        containsAny(text, [

            'খাইছিস',
            'খাইছো',
            'খেয়েছিস',
            'খেয়েছিস',
            'খেয়েছো',
            'খেয়েছো',
            'খাইছ',

            'khaiso',
            'kheyecho',
            'kheyechis'

        ])
    ) {
        return 'food';
    }


    // Sleep
    if (
        containsAny(text, [

            'ঘুমাইছিস',
            'ঘুমাইছো',
            'ঘুম আসছে',
            'ঘুমাবি',
            'ঘুমাবো',
            'ঘুমাতে যাব',

            'ghumaiso',
            'ghum asche'

        ])
    ) {
        return 'sleep';
    }


    // Thanks
    if (
        containsAny(text, [

            'ধন্যবাদ',
            'অনেক ধন্যবাদ',
            'thanks',
            'thank you',
            'thnx',
            'থ্যাংকস'

        ])
    ) {
        return 'thanks';
    }


    // Sorry
    if (
        containsAny(text, [

            'সরি',
            'sorry',
            'দুঃখিত',
            'মাফ কর'

        ])
    ) {
        return 'sorry';
    }


    // Confirmation
    if (
        containsAny(text, [

            'সত্যি',
            'সত্যি নাকি',
            'আসলেই',
            'তাই নাকি',
            'সত্যি বলছ',

            'sotti',
            'really',
            'seriously'

        ])
    ) {
        return 'confirmation';
    }


    // Agreement
    if (

        text === 'হুম' ||
        text === 'হুমম' ||
        text === 'হ্যাঁ' ||
        text === 'হ্যা' ||
        text === 'আচ্ছা' ||
        text === 'ঠিক' ||
        text === 'ঠিক আছে' ||
        text === 'hmm' ||
        text === 'ok' ||
        text === 'okay' ||
        text === 'yes'

    ) {
        return 'agreement';
    }


    // Confusion
    if (
        containsAny(text, [

            'বুঝলাম না',
            'বুঝি নাই',
            'বুঝি না',
            'কি বলছ',
            'কী বলছ',
            'মানে',
            'কোনটা',

            'bujhi nai',
            'bujhlam na',
            'what do you mean'

        ])
    ) {
        return 'confusion';
    }


    // Missing
    if (
        containsAny(text, [

            'মনে পড়ছে',
            'মনে পড়ছে',
            'মিস করছি',
            'মিস করতেছি',
            'মিস করতেছ',

            'miss you',
            'miss u',
            'mone porche'

        ])
    ) {
        return 'missing';
    }


    // Mood
    if (
        containsAny(text, [

            'মন খারাপ',
            'ভালো লাগছে না',
            'খারাপ লাগছে',
            'মনটা ভালো না',
            'বিরক্ত লাগছে',
            'মন ভালো নেই',
            'sad'

        ])
    ) {
        return 'mood';
    }


    // Laugh
    if (
        containsAny(text, [

            'হাহা',
            'হাহাহা',
            'haha',
            'hahaha',
            'lol',
            '😂',
            '🤣'

        ])
    ) {
        return 'laugh';
    }


    // Goodbye
    if (
        containsAny(text, [

            'বিদায়',
            'যাই',
            'পরে কথা হবে',
            'পরে কথা বলি',
            'আচ্ছা যাই',
            'bye',
            'goodbye',
            'see you'

        ])
    ) {
        return 'goodbye';
    }


    // Morning
    if (
        containsAny(text, [

            'শুভ সকাল',
            'সুপ্রভাত',
            'good morning'

        ])
    ) {
        return 'morning';
    }


    // Night
    if (
        containsAny(text, [

            'শুভ রাত্রি',
            'শুভ রাত',
            'good night',
            'শুভরাত্রি'

        ])
    ) {
        return 'night';
    }


    // Congratulations
    if (
        containsAny(text, [

            'অভিনন্দন',
            'congratulations',
            'congrats'

        ])
    ) {
        return 'congratulations';
    }


    return 'general';
}


// ============================================================
// REPLIES
// ============================================================

const RESPONSES = {

    greeting: [

        'হেই 😄 বলো কী খবর?',
        'ওই 😄 কেমন আছিস?',
        'হুম বলো, শুনতেছি 😄',
        'হ্যালো 😄 কী অবস্থা?',
        'আরে হাই 😂 বলো।'

    ],


    how_are_you: [

        'এই তো ভালো আছি 😄 তুই কেমন আছিস?',
        'ভালোই আছি আলহামদুলিল্লাহ 🙂 তোর কী খবর?',
        'এই তো চলছে 😅 তুই কেমন?',
        'ভালো আছি 😄 আজকে কী অবস্থা তোর?'

    ],


    activity: [

        'এই তো একটু বসে আছি 😄',
        'কিছু না, একটু ফোন দেখতেছি 😂',
        'একটু কাজ করতেছিলাম, এখন ফ্রি আছি 😄',
        'এই তো আছি, বল কী হইছে?',
        'কিছু একটা করতেছিলাম 😅 তুই কী করিস?'

    ],


    location: [

        'এই তো আছি 😄 কেন?',
        'বাসাতেই আছি। তুই কোথায়?',
        'এই দিকেই আছি 😅 হঠাৎ?',
        'কাছেই আছি 😄 কী হইছে?'

    ],


    availability: [

        'না, এখন মোটামুটি ফ্রি আছি 😄',
        'একটু ব্যস্ত ছিলাম, এখন বল।',
        'এখন বলতে পারিস 😄',
        'না না, বল কী বলবি।'

    ],


    permission: [

        'হুম বল 😄',
        'বলে ফেল 😂',
        'হ্যাঁ বল, কী হইছে?',
        'অবশ্যই বল 😄'

    ],


    food: [

        'হ্যাঁ খাইছি 😄 তুই খাইছিস?',
        'এখনো খাই নাই 😅 তুই?',
        'খাইছি তো 😂',
        'না, একটু পরে খাবো।'

    ],


    sleep: [

        'এখনো ঘুমাই নাই 😅',
        'ঘুম আসতেছে একটু একটু 😴',
        'না, এখনো জেগেই আছি 😄',
        'হুম, মনে হয় একটু পরে ঘুমাবো।'

    ],


    thanks: [

        'আরে কোনো ব্যাপার না 😄',
        'এটার জন্য আবার thanks কিসের 😂',
        'Welcome 😄',
        'আরে ঠিক আছে।'

    ],


    sorry: [

        'আরে সমস্যা নাই 😄',
        'কোনো ব্যাপার না।',
        'ঠিক আছে, চিন্তা করিস না 🙂',
        'আরে ঠিক আছে 😂'

    ],


    confirmation: [

        'হ্যাঁ রে 😄',
        'হুম, সত্যিই 😂',
        'হ্যাঁ, ঠিকই বলছি।',
        'আরে হ্যাঁ 😄'

    ],


    missing: [

        'হুম, অনেকদিন পর কথা হইতেছে 😄',
        'আমিও ভাবছিলাম তোর কথা।',
        'হাহা 😅 সত্যি নাকি?',
        'আরে আমিও তো মনে করতেছিলাম।'

    ],


    mood: [

        'কী হইছে? মন খারাপ কেন?',
        'আরে কী হয়েছে বল তো 🙂',
        'কিছু নিয়ে চিন্তা করতেছিস?',
        'বল, কী নিয়ে খারাপ লাগছে?'

    ],


    laugh: [

        '😂😂',
        'হাহাহা 😂',
        'আরে থাম 😂',
        'তুইও না 😂'

    ],


    goodbye: [

        'আচ্ছা ঠিক আছে 😄 পরে কথা হবে।',
        'ঠিক আছে, পরে নক দিস।',
        'আচ্ছা তাহলে পরে কথা বলি 🙂',
        'ঠিক আছে, ভালো থাকিস।'

    ],


    morning: [

        'শুভ সকাল 😄 ঘুম কেমন হইছে?',
        'সুপ্রভাত 😄 আজকের দিনটা কেমন যাচ্ছে?',
        'শুভ সকাল! ☀️ কী খবর?'

    ],


    night: [

        'শুভ রাত্রি 😴 ভালো করে ঘুমাস।',
        'আচ্ছা, শুভ রাত্রি 😄',
        'Good night 😴 কাল কথা হবে।'

    ],


    congratulations: [

        'ওয়াও! অভিনন্দন 😄🎉',
        'দারুণ তো! অভিনন্দন 👏',
        'অনেক অভিনন্দন 😄'

    ],


    general: [

        'হুম 😄 তারপর?',
        'আচ্ছা তাই নাকি 😂',
        'হুম বুঝলাম।',
        'ও আচ্ছা 😄',
        'তারপর কী হইলো?',
        'হুম বল, শুনতেছি।',
        'আচ্ছা আচ্ছা 😂',
        'সত্যি নাকি? 😄',
        'ওহ বুঝলাম 👀',
        'হুম, তারপর বল।'

    ]
};


// ============================================================
// CONTEXT ENGINE
// ============================================================

function generateReply(
    chatId,
    message,
    intent
) {

    const chat =
        getMemory(chatId);

    const text =
        normalize(message);


    // Commands
    if (intent === 'help') {

        return `
আচ্ছা 😄

/help — commands
/ping — status
/time — সময়
/id — chat ID
/clear — memory clear

সাধারণভাবেও কথা বলতে পারিস 🙂
        `.trim();
    }


    if (intent === 'ping') {

        return 'হুম 😄 অন আছি তো।';
    }


    if (intent === 'time') {

        return `এখন সময় ${getTime()} 🕒`;
    }


    if (intent === 'id') {

        return `এই chat-এর ID:\n${chatId}`;
    }


    if (intent === 'clear') {

        memory[chatId] = {

            history: [],

            lastIntent: null,

            lastUserMessage: null,

            lastBotMessage: null,

            updatedAt: Date.now()
        };

        saveMemory();

        return 'আচ্ছা 😄 আগের কথাগুলো clear করে দিলাম।';
    }


    // Short answer + previous context
    if (
        text.length <= 5 &&
        chat.lastIntent
    ) {

        if (
            text === 'হুম' ||
            text === 'হুমম' ||
            text === 'হ্যাঁ' ||
            text === 'আচ্ছা' ||
            text === 'ঠিক'
        ) {

            return random([

                'হুম 😄',
                'আচ্ছা 😄 তারপর?',
                'হুম বুঝলাম।',
                'ঠিক আছে 😄 বল।',
                'হুম, শুনতেছি।'

            ]);
        }
    }


    // তারপর
    if (
        containsAny(text, [

            'তারপর',
            'এরপর',
            'তারপর কি',
            'তারপর কী',
            'then what',
            'and then'

        ])
    ) {

        return random([

            'তারপর তো তুই বল 😄',
            'হুম, তারপর কী হইলো?',
            'আচ্ছা তারপর? 👀',
            'বলে যা, শুনতেছি 😄'

        ]);
    }


    // Context continuation
    if (
        intent === 'general' &&
        chat.history.length >= 2
    ) {

        return random([

            'হুম, বুঝলাম 😄',
            'আচ্ছা, তারপর বল।',
            'ওহ আচ্ছা 😂',
            'হুম, শুনতেছি।',
            'বুঝলাম। এরপর কী হইলো?'

        ]);
    }


    return random(
        RESPONSES[intent] ||
        RESPONSES.general
    );
}


// ============================================================
// EVENTS
// ============================================================

client.on(
    'ready',
    () => {

        console.log('');
        console.log(
            '======================================'
        );

        console.log(
            '💬 FRIENDLY CONTEXT BOT'
        );

        console.log(
            '======================================'
        );

        console.log(
            '✅ WhatsApp connected'
        );

        console.log(
            '🧠 Context memory enabled'
        );

        console.log(
            '🇧🇩 Bangla + Banglish enabled'
        );

        console.log(
            '💬 Waiting for messages...'
        );

        console.log(
            '======================================'
        );

        console.log('');
    }
);


client.on(
    'authenticated',
    () => {

        console.log(
            '🔐 Authentication successful'
        );
    }
);


client.on(
    'auth_failure',
    error => {

        console.error(
            '❌ Authentication failed:',
            error
        );
    }
);


client.on(
    'disconnected',
    reason => {

        console.log(
            `⚠️ WhatsApp disconnected: ${reason}`
        );
    }
);


client.on(
    'change_state',
    state => {

        console.log(
            `📡 WhatsApp state: ${state}`
        );
    }
);


// ============================================================
// MESSAGE
// ============================================================

client.on(
    'message',
    async msg => {

        try {

            if (!msg) {
                return;
            }


            // নিজের message বাদ
            if (
                msg.fromMe
            ) {
                return;
            }


            // Group বাদ
            if (
                msg.isGroup
            ) {
                return;
            }


            // Status বাদ
            if (
                msg.from ===
                'status@broadcast'
            ) {
                return;
            }


            const body =
                (msg.body || '').trim();


            if (!body) {
                return;
            }


            // Duplicate protection
            const messageId =
                msg.id?._serialized;


            if (messageId) {

                if (
                    processedMessages.has(
                        messageId
                    )
                ) {
                    return;
                }


                processedMessages.add(
                    messageId
                );


                if (
                    processedMessages.size >
                    5000
                ) {

                    const first =
                        processedMessages
                            .values()
                            .next()
                            .value;

                    processedMessages.delete(
                        first
                    );
                }
            }


            const chatId =
                msg.from;


            console.log('');
            console.log(
                '--------------------------------------'
            );

            console.log(
                `📩 ${chatId}`
            );

            console.log(
                `💬 ${body}`
            );


            // Intent
            const intent =
                detectIntent(body);


            console.log(
                `🧠 Intent: ${intent}`
            );


            // Save incoming message
            addHistory(
                chatId,
                'user',
                body,
                intent
            );


            // Cooldown
            if (
                isCooldown(chatId)
            ) {

                console.log(
                    '⏱️ Cooldown'
                );

                return;
            }


            setCooldown(chatId);


            // Generate reply
            const reply =
                generateReply(
                    chatId,
                    body,
                    intent
                );


            if (!reply) {
                return;
            }


            // Typing
            try {

                const chat =
                    await msg.getChat();


                await chat.sendStateTyping();


                await sleep(
                    Math.floor(
                        Math.random() *
                        700
                    ) + 500
                );


                await chat.clearState();

            } catch (error) {

                // Ignore typing error
            }


            // Send
            await client.sendMessage(
                chatId,
                reply
            );


            // Save reply
            addHistory(
                chatId,
                'bot',
                reply,
                intent
            );


            console.log(
                `✅ Reply: ${reply}`
            );


        } catch (error) {

            console.error(
                '❌ Message error:',
                error
            );
        }
    }
);


// ============================================================
// ERROR HANDLING
// ============================================================

process.on(
    'unhandledRejection',
    error => {

        console.error(
            '❌ Unhandled rejection:',
            error
        );
    }
);


process.on(
    'uncaughtException',
    error => {

        console.error(
            '❌ Uncaught exception:',
            error
        );
    }
);


// ============================================================
// SHUTDOWN
// ============================================================

async function shutdown(signal) {

    console.log(
        `\n🛑 ${signal} received`
    );


    try {

        saveMemory();

        await client.destroy();

    } catch (error) {

        console.error(
            'Shutdown error:',
            error
        );
    }


    process.exit(0);
}


process.on(
    'SIGINT',
    () => shutdown('SIGINT')
);


process.on(
    'SIGTERM',
    () => shutdown('SIGTERM')
);


// ============================================================
// START + PAIRING CODE
// ===============================================================
async function start() {
    try {
        loadMemory();

        console.log('');
        console.log('⏳ WhatsApp চালু হচ্ছে...');

        // LocalAuth-এর saved session ব্যবহার করবে
        await client.initialize();

        console.log('✅ WhatsApp session restored.');

    } catch (error) {
        console.error('');
        console.error('❌ Saved session পাওয়া যায়নি বা initialize করতে সমস্যা হয়েছে।');
        console.error(error);
        console.error('');

        // নতুন pairing-এর জন্য নম্বর চাইবে
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        try {
            const phoneNumber = await new Promise(resolve => {
                rl.question(
                    '📱 WhatsApp নম্বর দিন (country code সহ, + ছাড়া): ',
                    answer => {
                        rl.close();
                        resolve(
                            answer
                                .trim()
                                .replace(/\D/g, '')
                        );
                    }
                );
            });

            if (!phoneNumber || phoneNumber.length < 8) {
                console.log('❌ Invalid phone number.');
                process.exit(1);
            }

            console.log(`📱 Number: ${phoneNumber}`);
            console.log('⏳ Pairing code তৈরি হচ্ছে...');

            const pairingCode =
                await client.requestPairingCode(phoneNumber);

            console.log('');
            console.log('======================================');
            console.log('🔐 WHATSAPP PAIRING CODE');
            console.log('======================================');
            console.log(pairingCode);
            console.log('======================================');
            console.log('');
            console.log(
                'WhatsApp → Settings → Linked Devices'
            );
            console.log(
                '→ Link a device → Link with phone number instead'
            );
            console.log(
                '→ উপরের code দিন।'
            );
            console.log('');

        } catch (pairingError) {
            console.error(
                '❌ Pairing error:',
                pairingError
            );
        }
    }
}

start();
