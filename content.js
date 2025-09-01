chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getText") {
      sendResponse({
          text: document.body.innerText,
          title: document.title
      });
  } else if (request.action === "getLinks") {
      const links = Array.from(document.links)
          .map(link => link.href)
          .filter((href, index, self) => href && self.indexOf(href) === index)
          .slice(request.exclude, request.exclude + request.count);
      sendResponse({links: links});
  } else if (request.action === "sendToChatbot") {
      const inputField = document.querySelector('div[contenteditable="true"][role="textbox"]');
      if (inputField) {
          inputField.textContent = request.prompt + "\n\n" + request.text;
          inputField.dispatchEvent(new Event("input", {bubbles: true}));
          inputField.focus();
          inputField.dispatchEvent(new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              which: 13,
              keyCode: 13,
              bubbles: true,
          }));
      }
  }
  return true;
});