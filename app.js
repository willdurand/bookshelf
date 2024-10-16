class App {
  #list;
  #copyEl;
  #popoverMessageEl;
  #scanEl;
  #searchEl;
  #videoEl;
  #audioContext;

  constructor() {
    this.#list = new List("books", {
      valueNames: ["isbn", "title", "authors", "year"],
    });
    this.#searchEl = document.querySelector('input[name="search"]');
    this.#popoverMessageEl = document.querySelector("#popover-message");

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("search")) {
      const value = searchParams.get("search");
      this.#updateSearchValue(value);
    }

    // If we have access to media devices and to the Barcode API, we set up the
    // barcode scanning feature, otherwise we remove the button.
    this.#scanEl = document.querySelector("#scan");
    if ("mediaDevices" in navigator && "BarcodeDetector" in window) {
      this.#videoEl = document.querySelector("#stream");
      this.#audioContext = window.AudioContext
        ? new window.AudioContext()
        : null;
      this.#scanEl.addEventListener(
        "click",
        this.#onScanButtonClick.bind(this),
      );
    } else {
      this.#scanEl.remove();
    }

    // If we have access to the clipboard, we set up the copy-to-clipboard
    // feature, otherwise we remove the button.
    this.#copyEl = document.querySelector("#copy");
    if ("clipboard" in navigator) {
      this.#copyEl.addEventListener(
        "click",
        this.#onCopyButtonClick.bind(this),
      );
    } else {
      this.#copyEl.remove();
    }
  }

  async #onScanButtonClick() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "environment",
        },
      });
    } catch (err) {
      this.#showPopoverMessage(
        `Failed to get access to the camera: ${err.message}`,
      );
      return;
    }

    // Disable the scan button.
    this.#scanEl.disabled = true;

    // Make video element visible and start the stream.
    this.#videoEl.style.display = "block";
    this.#videoEl.srcObject = stream;
    this.#videoEl.play();

    try {
      const isbn = await this.#readISBN();
      this.#emitBeep();
      this.#updateSearchValue(isbn);
    } catch (err) {
      this.#showPopoverMessage(`Failed to read ISBN: ${err.message}`);
    }

    // Stop the stream, hide the element.
    stream.getTracks().forEach((track) => track.stop());
    this.#videoEl.style.display = "none";
    // Re-enable the scan button.
    this.#scanEl.disabled = false;
  }

  #onCopyButtonClick() {
    // Disable the copy button.
    this.#copyEl.disabled = true;

    // Copy the content to the clipboard.
    navigator.clipboard.writeText(this.#searchEl.value);

    const prevContent = this.#copyEl.textContent;
    this.#copyEl.textContent = "✅";
    setTimeout(() => {
      this.#copyEl.textContent = prevContent;
      this.#copyEl.disabled = false;
    }, 2000);
  }

  async #readISBN() {
    return new Promise((resolve, reject) => {
      try {
        const detector = new BarcodeDetector({ formats: ["ean_13"] });

        let intervalID;
        intervalID = window.setInterval(async () => {
          const barcodes = await detector.detect(this.#videoEl);
          if (barcodes.length <= 0) {
            return;
          }

          clearInterval(intervalID);
          resolve(barcodes[0].rawValue.split(" ")[0]);
        }, 500);
      } catch (err) {
        console.error("Failed to detect barcode:", err);
        reject(err);
      }
    });
  }

  #updateSearchValue(value) {
    this.#searchEl.value = value;
    this.#list.search(value);

    const url = new URL(window.location);
    url.searchParams.set("search", value);
    window.history.pushState(null, null, url);
  }

  #emitBeep() {
    if (!this.#audioContext) {
      return;
    }

    const gain = this.#audioContext.createGain();
    gain.gain.value = 0.1;
    gain.connect(this.#audioContext.destination);

    const oscillator = this.#audioContext.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.value = 500;
    oscillator.connect(gain);

    oscillator.start(this.#audioContext.currentTime);
    oscillator.stop(this.#audioContext.currentTime + 0.1);
  }

  #showPopoverMessage(message) {
    console.warn(message);

    if (!HTMLElement.prototype.hasOwnProperty("popover")) {
      return;
    }

    this.#popoverMessageEl.textContent = message;
    this.#popoverMessageEl.togglePopover();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new App();
});
