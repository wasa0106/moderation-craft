/**
 * Fitbitトークンの暗号化・復号化ユーティリティ
 * ブラウザのWeb Crypto APIを使用して、トークンを安全に保存します
 */

// 暗号化キーを生成または取得
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('moderation-craft-fitbit-key-2024'), // 固定キー（本番環境では環境変数から取得）
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Salt（固定値、本番環境ではランダム生成推奨）
  const salt = new TextEncoder().encode('mc-fitbit-salt');
  
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * データを暗号化
 * @param data 暗号化するデータ
 * @returns 暗号化されたデータ（Base64）
 */
export async function encrypt(data: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);
    
    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );
    
    // IVと暗号化データを結合
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);
    
    // Base64エンコード
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * データを復号化
 * @param encryptedData 暗号化されたデータ（Base64）
 * @returns 復号化されたデータ
 */
export async function decrypt(encryptedData: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    
    // Base64デコード
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // IVと暗号化データを分離
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decryptedData = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * トークンをセキュアに保存
 * @param key 保存キー
 * @param value 保存する値
 */
export async function secureStore(key: string, value: string): Promise<void> {
  try {
    const encrypted = await encrypt(value);
    localStorage.setItem(`secure_${key}`, encrypted);
  } catch (error) {
    console.error('Secure store failed:', error);
    throw error;
  }
}

/**
 * トークンをセキュアに取得
 * @param key 取得キー
 * @returns 復号化された値
 */
export async function secureRetrieve(key: string): Promise<string | null> {
  try {
    const encrypted = localStorage.getItem(`secure_${key}`);
    if (!encrypted) return null;
    
    return await decrypt(encrypted);
  } catch (error) {
    console.error('Secure retrieve failed:', error);
    return null;
  }
}

/**
 * セキュアストレージから削除
 * @param key 削除キー
 */
export function secureRemove(key: string): void {
  localStorage.removeItem(`secure_${key}`);
}