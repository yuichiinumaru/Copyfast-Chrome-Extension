chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") {
      chrome.storage.sync.set({
          opacity: 100,
          alwaysOnTop: false,
          chatbotLink: "",
          chatbotPrompt: "",
          numLinksToOpen: 10,
          numLinksToExclude: 0,
      });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
      case "textify":
          textifyTabs();
          break;
      case "copyText":
          copyTextFromTabs();
          break;
      case "openLinks":
          openLinksFromCurrentTab(request.count, request.exclude);
          break;
      case "sendToChatbot":
          sendToChatbot(request.text);
          break;
      case "copyTabsLinks":
          copyTabsLinks();
          break;
      case "copyAllLinks":
          copyAllLinksFromPage();
          break;
      case "openNotepadLinks":
          openLinksFromNotepad();
          break;
  }
  sendResponse({status: "Action received"});
  return true;
});

function textifyTabs() {
  chrome.tabs.query({highlighted: true, currentWindow: true}, (tabs) => {
      tabs.forEach(tab => {
          const url = new URL(tab.url);
          const textifiedUrl = `https://txtify.it/${url.hostname}${url.pathname}${url.search}`;
          chrome.tabs.update(tab.id, {url: textifiedUrl});
      });
  });
}

function copyTextFromTabs() {
  chrome.tabs.query({highlighted: true, currentWindow: true}, (tabs) => {
      let allContent = "";
      let tabsProcessed = 0;

      tabs.forEach(tab => {
          chrome.scripting.executeScript({
              target: {tabId: tab.id},
              function: () => ({text: document.body.innerText, title: document.title})
          }, (results) => {
              if (results && results[0] && results[0].result) {
                  allContent += `Title: ${results[0].result.title}\n\n${results[0].result.text}\n\n___________\n\n`;
              }
              tabsProcessed++;
              if (tabsProcessed === tabs.length) {
                  storeTextInChunks(allContent, 'notepadContent', () => {
                      chrome.runtime.sendMessage({action: "updateNotepad", content: allContent});
                  });
              }
          });
      });
  });
}

function openLinksFromCurrentTab(count, exclude) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
          chrome.scripting.executeScript({
              target: {tabId: tabs[0].id},
              function: () => Array.from(document.links).map(link => link.href)
          }, (results) => {
              if (results && results[0] && results[0].result) {
                  results[0].result.slice(exclude, exclude + count).forEach(link => {
                      chrome.tabs.create({url: link, active: false});
                  });
              }
          });
      }
  });
}

function sendToChatbot(text) {
  chrome.storage.sync.get(["chatbotLink", "chatbotPrompt"], (result) => {
      if (result.chatbotLink) {
          chrome.tabs.create({url: result.chatbotLink}, (tab) => {
              chrome.scripting.executeScript({
                  target: {tabId: tab.id},
                  function: (data) => {
                      const inputField = document.querySelector('div[contenteditable="true"][role="textbox"]');
                      if (inputField) {
                          inputField.textContent = data.prompt + '\n\n' + data.text;
                          inputField.dispatchEvent(new Event('input', {bubbles: true}));
                          inputField.focus();
                          inputField.dispatchEvent(new KeyboardEvent('keydown', {
                              key: 'Enter',
                              code: 'Enter',
                              which: 13,
                              keyCode: 13,
                              bubbles: true
                          }));
                      }
                  },
                  args: [{prompt: result.chatbotPrompt, text: text}]
              });
          });
      }
  });
}

function copyTabsLinks() {
  chrome.tabs.query({highlighted: true, currentWindow: true}, (tabs) => {
      const links = tabs.map(tab => tab.url).join("\n");
      storeTextInChunks(links, 'notepadContent', () => {
          chrome.runtime.sendMessage({action: "updateNotepad", content: links});
      });
  });
}

function copyAllLinksFromPage() {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].id) {
          chrome.scripting.executeScript({
              target: {tabId: tabs[0].id},
              function: () => {
                  return Array.from(document.links)
                              .map(link => link.href)
                              .filter((href, index, self) => href && self.indexOf(href) === index);
              }
          }, (results) => {
              if (chrome.runtime.lastError) {
                  console.error(`Error executing script on tab ${tabs[0].id}: ${chrome.runtime.lastError.message}`);
                  const errorMsg = `Error getting links: ${chrome.runtime.lastError.message}`;
                   storeTextInChunks(errorMsg, 'notepadContent', () => {
                      chrome.runtime.sendMessage({action: "updateNotepad", content: errorMsg});
                  });
                  return;
              }

              let linksContent = "No links found on the current page.";
              if (results && results[0] && results[0].result && results[0].result.length > 0) {
                  linksContent = results[0].result.join("\n");
              } else if (results && results[0] && results[0].result && results[0].result.length === 0) {
                  // Keep the "No links found" message if the array is empty
              } else {
                   console.log("Script execution result was unexpected or empty:", results);
                   // Keep the default "No links found" message
              }

              storeTextInChunks(linksContent, 'notepadContent', () => {
                  chrome.runtime.sendMessage({action: "updateNotepad", content: linksContent});
              });
          });
      } else {
          console.error("Could not find active tab.");
          const errorMsg = "Error: Could not find active tab.";
          storeTextInChunks(errorMsg, 'notepadContent', () => {
              chrome.runtime.sendMessage({action: "updateNotepad", content: errorMsg});
          });
      }
  });
}

function openLinksFromNotepad() {
    retrieveTextFromChunks('notepadContent', (text) => {
        if (text) {
            const lines = text.split('\n');
            let openedCount = 0;
            lines.forEach(line => {
                const trimmedLine = line.trim();
                // Basic URL check - could be more sophisticated
                if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
                    try {
                        // Validate URL format more strictly
                        new URL(trimmedLine);
                        chrome.tabs.create({ url: trimmedLine, active: false });
                        openedCount++;
                    } catch (e) {
                        console.warn(`Skipping invalid URL format: ${trimmedLine}`);
                    }
                } else if (trimmedLine) {
                     console.log(`Skipping non-URL line: ${trimmedLine}`);
                }
            });
             console.log(`Attempted to open ${openedCount} links from notepad.`);
            // Optionally send a message back to popup if needed, e.g., update status
            // chrome.runtime.sendMessage({ action: "updateStatus", message: `Opened ${openedCount} links.` });
        } else {
            console.log("Notepad content is empty or could not be retrieved.");
            // Optionally send a message back to popup
            // chrome.runtime.sendMessage({ action: "updateStatus", message: "Notepad is empty." });
        }
    });
}

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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
      chrome.storage.sync.get('alwaysOnTop', result => {
          if (result.alwaysOnTop) {
              chrome.windows.update(tab.windowId, {alwaysOnTop: true});
          }
      });
  }
});