/**
 * crypto.js — 隐私字段加密（AES-GCM + PBKDF2）
 * 只加密敏感字段，解密只发生在浏览器内存。
 */
(function () {
  'use strict';
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function b64(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(s) {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  async function deriveKey(passphrase, saltB64) {
    const salt = unb64(saltB64);
    const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: 120000, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  function newSalt() {
    const s = crypto.getRandomValues(new Uint8Array(16));
    return b64(s);
  }
  async function encryptText(text, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(String(text == null ? '' : text)));
    return { enc: true, iv: b64(iv), ct: b64(ct) };
  }
  async function decryptText(box, key) {
    if (!box || !box.enc) return box == null ? '' : String(box);
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
      return dec.decode(pt);
    } catch (e) {
      throw new Error('隐私密码错误或数据已损坏');
    }
  }
  // 加密对象中的指定字段
  async function encryptFields(obj, key, fields) {
    const out = Object.assign({}, obj || {});
    for (const f of fields) {
      if (out[f] !== undefined && out[f] !== null && !(out[f] && out[f].enc)) {
        out[f] = await encryptText(out[f], key);
      }
    }
    return out;
  }
  // 解密对象中的加密字段（原地返回新对象）
  async function decryptFields(obj, key) {
    const out = Object.assign({}, obj || {});
    for (const k of Object.keys(out)) {
      if (out[k] && out[k].enc) out[k] = await decryptText(out[k], key);
    }
    return out;
  }

  window.CryptoBox = {
    deriveKey: deriveKey,
    newSalt: newSalt,
    encryptText: encryptText,
    decryptText: decryptText,
    encryptFields: encryptFields,
    decryptFields: decryptFields
  };
})();
