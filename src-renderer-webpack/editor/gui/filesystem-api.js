/**
 * Partial reimplementation of the FileSystem API (https://web.dev/file-system-access/)
 * 
 * Unlike the default FileSystem API, we can construct a file handle from an ID from
 * the main process without showing the file picker. The IDs are managed by the main
 * process, so malicious extensions can't abuse this to get arbitrary read/write,
 * and it lets us not share full file paths which could contain eg. the user's name.
 */

/**
 * @param {unknown} contents
 * @returns {Uint8Array}
 */
const toUnit8Array = (contents) => {
  if (contents instanceof Uint8Array) {
    return contents;
  }
  if (contents instanceof Blob) {
    throw new Error('Should never receive a Blob here.');
  }
  return new Uint8Array(contents);
};

class WrappedFileWritable {
  /**
   * @param {string} id File ID from main
   * @param {string} name File name to detect .hwp format
   */
  constructor (id, name) {
    this._channel = new MessageChannel();
    this._isHwp = name && name.toLowerCase().endsWith('.hwp');
    this._name = name;
    this._hwpBuffer = [];

    /** @type {Map<string, {resolve: () => void, reject: (error: unknown) => void}>} */
    this._callbacks = new Map();
    this._lastMessageId = 1;

    /**
     * Error from the main process, if any.
     * @type {unknown}
     */
    this._error = null;

    this._channel.port1.onmessage = (event) => {
      const data = event.data;

      const error = data.error;
      if (error) {
        this._error = error;
        for (const handlers of this._callbacks.values()) {
          handlers.reject(error);
        }
        this._callbacks.clear();
      }

      const response = data.response;
      if (response) {
        const id = response.id;
        const handlers = this._callbacks.get(id);
        if (handlers) {
          handlers.resolve(response.result);
          this._callbacks.delete(id);
        }
      }
    };

    // Note that we don't need to wait for the other end before we can start sending data. The messages
    // will just be queued up.
    // We use this weird postMessage because Electron's context bridge doesn't handle the channel objects.
    window.postMessage({
      ipcStartWriteStream: id
    }, window.origin, [this._channel.port2])
  }

  _sendToMainAndWait (message) {
    if (this._error) {
      throw this._error;
    }

    const messageId = this._lastMessageId++;
    message.id = messageId;
    return new Promise((resolve, reject) => {
      this._callbacks.set(messageId, {
        resolve,
        reject
      });
      this._channel.port1.postMessage(message);
    });
  }

  async write (contents) {
    // For HWP, buffer all SB3 data; for SB3, stream directly
    if (this._isHwp) {
      this._hwpBuffer.push(toUnit8Array(contents));
    } else {
      await this._sendToMainAndWait({
        write: toUnit8Array(contents)
      });
    }
  }

  async close () {
    if (this._isHwp) {
      // Concatenate all SB3 chunks, convert to HWP via main process
      const totalLength = this._hwpBuffer.reduce((sum, arr) => sum + arr.byteLength, 0);
      const fullSb3 = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of this._hwpBuffer) {
        fullSb3.set(chunk, offset);
        offset += chunk.byteLength;
      }
      this._hwpBuffer = [];

      // Convert SB3 to HWP in main process
      const hwpData = await EditorPreload.convertToHwp(fullSb3.buffer);
      
      // Write HWP data as a single write
      await this._sendToMainAndWait({
        write: new Uint8Array(hwpData)
      });
      await this._sendToMainAndWait({
        finish: true
      });
    } else {
      await this._sendToMainAndWait({
        finish: true
      });
    }
  }

  async abort () {
    this._hwpBuffer = [];
    await this._sendToMainAndWait({
      abort: true
    });
  }
}

class WrappedFileHandle {
  /**
   * @param {string} id File ID from main.
   * @param {string} name Name including file extension.
   */
  constructor (id, name) {
    this.id = id;
    this.name = name;
  }

  async getFile () {
    const data = await EditorPreload.getFile(this.id);
    return new File([data.data], this.name);
  }

  async createWritable () {
    return new WrappedFileWritable(this.id, this.name);
  }
}

class AbortError extends Error {
  constructor (message) {
    super(message);
    this.name = 'AbortError';
  }
}

class BrowserDownloadWritable {
  constructor (name) {
    this._name = name;
    this._chunks = [];
  }

  async write (contents) {
    this._chunks.push(toUnit8Array(contents));
  }

  async close () {
    const blob = new Blob(this._chunks, {type: 'application/octet-stream'});
    this._chunks = [];
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this._name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async abort () {
    this._chunks = [];
  }
}

class BrowserDownloadFileHandle {
  constructor (name) {
    this.id = null;
    this.name = name;
  }

  async createWritable () {
    return new BrowserDownloadWritable(this.name);
  }
}

const pickFileWithInput = options => new Promise((resolve, reject) => {
  const input = document.createElement('input');
  input.type = 'file';
  if (options && Array.isArray(options.types)) {
    const extensions = [];
    for (const type of options.types) {
      for (const accept of Object.values(type.accept || {})) {
        extensions.push(...accept);
      }
    }
    input.accept = extensions.join(',');
  }
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (file) {
      resolve([{name: file.name, getFile: async () => file}]);
    } else {
      reject(new AbortError('No file selected'));
    }
  };
  input.oncancel = () => reject(new AbortError('No file selected'));
  input.click();
});

const showOpenFilePicker = async (options) => {
  if (EditorPreload.isWebShim) {
    if (typeof window.showOpenFilePicker === 'function') {
      return window.showOpenFilePicker(options);
    }
    return pickFileWithInput(options);
  }
  const result = await EditorPreload.showOpenFilePicker();
  if (result === null) {
    throw new AbortError('No file selected');
  }
  return [new WrappedFileHandle(result.id, result.name)];
};

const showSaveFilePicker = async (options) => {
  // Strip any existing extension from suggestedName to avoid double extensions
  let suggestedName = options.suggestedName || 'project';
  // Remove .sb3, .sb2, .sb, .hwp if present
  suggestedName = suggestedName.replace(/\.(sb3|sb2|sb|hwp)$/i, '');

  if (EditorPreload.isWebShim) {
    const extension = options && options.types && options.types[0] &&
      options.types[0].accept && Object.values(options.types[0].accept)[0] &&
      Object.values(options.types[0].accept)[0][0];
    const browserSuggestedName = `${suggestedName}${extension || '.sb3'}`;
    if (typeof window.showSaveFilePicker === 'function') {
      return window.showSaveFilePicker({
        ...options,
        suggestedName: browserSuggestedName
      });
    }
    return new BrowserDownloadFileHandle(browserSuggestedName);
  }
  
  const result = await EditorPreload.showSaveFilePicker(suggestedName);
  if (result === null) {
    throw new AbortError('No file selected');
  }
  return new WrappedFileHandle(result.id, result.name);
};

export {
  WrappedFileHandle,
  showOpenFilePicker,
  showSaveFilePicker
};
