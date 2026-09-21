const JSZip = require('@turbowarp/jszip');
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const FORMAT_VERSION = 2;
const ENCRYPTED_PROJECT_FILE = 'hiwarp/encrypted-project.bin';
const ENCRYPTED_MANIFEST_FILE = 'hiwarp/encryption.json';
const SUPPORTED_HASHES = ['SHA-256', 'SHA-384', 'SHA-512'];
const DEFAULT_WRONG_CREDENTIAL_PERMISSIONS = {
  viewSource: false,
  runProject: true,
  exportProject: false,
  editSource: false
};
const bytesToBase64 = bytes => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
const base64ToBytes = value => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};
const bytesToHex = bytes => Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
const normalizeHashAlgorithm = algorithm => {
  const normalized = String(algorithm || 'SHA-256').toUpperCase().replace(/^SHA(\d+)$/, 'SHA-$1');
  if (!SUPPORTED_HASHES.includes(normalized)) {
    throw new Error("\u4E0D\u652F\u6301\u7684\u5BC6\u7801\u52A0\u5BC6\u65B9\u5F0F\uFF1A".concat(algorithm));
  }
  return normalized;
};
const hashBytes = async (bytes, algorithm) => {
  const digest = await crypto.subtle.digest(normalizeHashAlgorithm(algorithm), bytes);
  return new Uint8Array(digest);
};
const keyFileToPassword = async (fileBytes, algorithm) => bytesToHex(await hashBytes(fileBytes, algorithm));
const deriveAesKey = async (password, salt, algorithm) => {
  const keyMaterial = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({
    name: 'PBKDF2',
    salt,
    iterations: 250000,
    hash: normalizeHashAlgorithm(algorithm)
  }, keyMaterial, {
    name: 'AES-GCM',
    length: 256
  }, false, ['encrypt', 'decrypt']);
};
const normalizeWrongCredentialPermissions = permissions => Object.assign({}, DEFAULT_WRONG_CREDENTIAL_PERMISSIONS, permissions || {});
const createFallbackProjectObject = manifest => ({
  targets: [{
    isStage: true,
    name: 'Stage',
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: {},
    comments: {},
    currentCostume: 0,
    costumes: [],
    sounds: [],
    volume: 100,
    layerOrder: 0,
    tempo: 60,
    videoTransparency: 50,
    videoState: 'on',
    textToSpeechLanguage: null
  }],
  monitors: [],
  extensions: [],
  meta: {
    semver: '3.0.0',
    vm: '1.0.0-hiwarp',
    agent: 'HiWarp',
    hiwarpEncryptedProject: true,
    hiwarpEncryptionVersion: manifest && manifest.version || FORMAT_VERSION
  },
  projectVersion: 3
});
const createFallbackProject = manifest => JSON.stringify(createFallbackProjectObject(manifest));
const encryptProjectJson = async (projectJson, options) => {
  options = options || {};
  const hashAlgorithm = normalizeHashAlgorithm(options.hashAlgorithm);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(options.password, salt, hashAlgorithm);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv
  }, key, textEncoder.encode(projectJson)));
  const manifest = {
    version: FORMAT_VERSION,
    cipher: 'AES-GCM',
    kdf: 'PBKDF2',
    iterations: 250000,
    hashAlgorithm,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    encryptedFile: ENCRYPTED_PROJECT_FILE,
    wrongCredentialPermissions: normalizeWrongCredentialPermissions(options.wrongCredentialPermissions),
    createdBy: 'HiWarp'
  };
  return {
    encrypted,
    manifest
  };
};
const decryptProjectJson = async (manifest, encrypted, password) => {
  const hashAlgorithm = normalizeHashAlgorithm(manifest.hashAlgorithm);
  const key = await deriveAesKey(password, base64ToBytes(manifest.salt), hashAlgorithm);
  const decrypted = await crypto.subtle.decrypt({
    name: 'AES-GCM',
    iv: base64ToBytes(manifest.iv)
  }, key, encrypted);
  return textDecoder.decode(decrypted);
};
const isEncryptedZip = zip => Boolean(zip.file(ENCRYPTED_MANIFEST_FILE) && zip.file(ENCRYPTED_PROJECT_FILE));
const readEncryptedManifest = async zip => {
  if (!isEncryptedZip(zip)) {
    return null;
  }
  return JSON.parse(await zip.file(ENCRYPTED_MANIFEST_FILE).async('string'));
};
const getEncryptedManifestFromSb3 = async input => {
  try {
    const zip = await JSZip.loadAsync(input);
    return readEncryptedManifest(zip);
  } catch (e) {
    return null;
  }
};
const getEncryptedProjectInfo = async input => {
  try {
    const zip = await JSZip.loadAsync(input);
    const manifest = await readEncryptedManifest(zip);
    return {
      encrypted: Boolean(manifest),
      manifest,
      zip
    };
  } catch (e) {
    return {
      encrypted: false,
      manifest: null,
      zip: null
    };
  }
};
const decryptSb3Buffer = async (input, password) => {
  const zip = await JSZip.loadAsync(input);
  const manifest = await readEncryptedManifest(zip);
  if (!manifest) {
    return {
      encrypted: false,
      data: input
    };
  }
  const encrypted = await zip.file(manifest.encryptedFile || ENCRYPTED_PROJECT_FILE).async('uint8array');
  const projectJson = await decryptProjectJson(manifest, encrypted, password);
  zip.file('project.json', projectJson);
  zip.remove(ENCRYPTED_MANIFEST_FILE);
  zip.remove(ENCRYPTED_PROJECT_FILE);
  zip.remove('hiwarp/');
  return {
    encrypted: true,
    data: await zip.generateAsync({
      type: input instanceof ArrayBuffer ? 'arraybuffer' : 'uint8array',
      mimeType: 'application/x.scratch.sb3'
    })
  };
};
const addEncryptedProjectToZip = async (zip, projectJson, options) => {
  const {
    encrypted,
    manifest
  } = await encryptProjectJson(projectJson, options);
  zip.file('project.json', createFallbackProject(manifest));
  zip.file(ENCRYPTED_MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  zip.file(ENCRYPTED_PROJECT_FILE, encrypted);
};
module.exports = {
  SUPPORTED_HASHES,
  ENCRYPTED_MANIFEST_FILE,
  DEFAULT_WRONG_CREDENTIAL_PERMISSIONS,
  createFallbackProject,
  createFallbackProjectObject,
  keyFileToPassword,
  addEncryptedProjectToZip,
  decryptSb3Buffer,
  getEncryptedProjectInfo,
  getEncryptedManifestFromSb3,
  readEncryptedManifest,
  normalizeWrongCredentialPermissions,
  isEncryptedZip
};