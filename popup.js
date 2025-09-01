document.addEventListener('DOMContentLoaded', function() {
    const configBtn = document.getElementById('configBtn');
    const configOverlay = document.getElementById('configOverlay');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const notepad = document.getElementById('notepad');
    const chatbotLink = document.getElementById('chatbotLink');
    const chatbotPrompt = document.getElementById('chatbotPrompt');
    const opacity = document.getElementById('opacity');
    const alwaysOnTop = document.getElementById('alwaysOnTop');
    const numLinksToOpen = document.getElementById('numLinksToOpen');
    const numLinksToExclude = document.getElementById('numLinksToExclude');

    chrome.storage.sync.get([
        'chatbotLink', 'chatbotPrompt', 'opacity', 'alwaysOnTop', 'numLinksToOpen', 'numLinksToExclude'
    ], function(result) {
        chatbotLink.value = result.chatbotLink || '';
        chatbotPrompt.value = result.chatbotPrompt || '';
        opacity.value = result.opacity || 100;
        alwaysOnTop.checked = result.alwaysOnTop || false;
        numLinksToOpen.value = result.numLinksToOpen || 10;
        numLinksToExclude.value = result.numLinksToExclude || 0;
        document.body.style.opacity = opacity.value / 100;
    });

    retrieveTextFromChunks('notepadContent', (text) => {
        notepad.value = text || '';
    });

    [notepad, chatbotLink, chatbotPrompt, opacity, alwaysOnTop, numLinksToOpen, numLinksToExclude].forEach(el => {
        el.addEventListener('change', saveSettings);
    });

    function saveSettings() {
        chrome.storage.sync.set({
            chatbotLink: chatbotLink.value,
            chatbotPrompt: chatbotPrompt.value,
            opacity: opacity.value,
            alwaysOnTop: alwaysOnTop.checked,
            numLinksToOpen: numLinksToOpen.value,
            numLinksToExclude: numLinksToExclude.value
        });
        document.body.style.opacity = opacity.value / 100;
        storeTextInChunks(notepad.value, 'notepadContent', () => {
            console.log('Notepad content saved');
        });
    }

    configBtn.addEventListener('click', () => configOverlay.style.display = 'flex');
    saveConfigBtn.addEventListener('click', () => configOverlay.style.display = 'none');

    document.getElementById('textifyBtn').addEventListener('click', () => sendMessage('textify'));
    document.getElementById('copyTextBtn').addEventListener('click', () => sendMessage('copyText'));
    document.getElementById('openLinksBtn').addEventListener('click', () => sendMessage('openLinks'));
    document.getElementById('copyTabsLinksBtn').addEventListener('click', () => sendMessage('copyTabsLinks'));
    document.getElementById('copyPageLinksBtn').addEventListener('click', () => sendMessage('copyAllLinks'));
    document.getElementById('sendToChatbotBtn').addEventListener('click', () => sendMessage('sendToChatbot'));
    document.getElementById('openNotepadLinksBtn').addEventListener('click', () => sendMessage('openNotepadLinks'));

    function sendMessage(action) {
        const currentNotepadValue = document.getElementById('notepad').value;

        chrome.runtime.sendMessage({
            action: action,
            count: parseInt(numLinksToOpen.value),
            exclude: parseInt(numLinksToExclude.value),
            text: currentNotepadValue
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Message sending failed:", chrome.runtime.lastError);
            } else {
                console.log("Message sent successfully:", response);
            }
        });
    }

    notepad.addEventListener('input', function() {
        if (this.value === 'duvido que foi o yuichi quem escreveu') {
            alert('Beleza irmão');
            this.value = '';
        }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "updateNotepad") {
            notepad.value = request.content;
        }
    });

    function storeTextInChunks(text, key, callback, chunkSize = 100000) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize));
        }
        chrome.storage.local.set({[key]: chunks}, () => {
            if (chrome.runtime.lastError) {
                console.error("Error storing chunks:", chrome.runtime.lastError);
            } else {
                callback();
            }
        });
    }

    function retrieveTextFromChunks(key, callback) {
        chrome.storage.local.get(key, (result) => {
            if (chrome.runtime.lastError) {
                console.error("Error retrieving chunks:", chrome.runtime.lastError);
                callback(null);
            } else if (result[key]) {
                callback(result[key].join(''));
            } else {
                callback(null);
            }
        });
    }
});