import * as SecureStore from "expo-secure-store";
import { type ForeignKeychainProvider, generateKeypairBytes } from "react-native-swarmnote-core";
import { useSwarmStore } from "@/stores/swarm-store";

const KEYPAIR_KEY = "swarmnote-keypair";

/** `ForeignKeychainProvider` backed by `expo-secure-store`. On first call
 *  generates a protobuf-encoded Ed25519 keypair via Rust (no libp2p encoding
 *  in JS) and persists it; subsequent calls return the same bytes so the
 *  peer id stays stable across launches.
 *
 *  Fallback: if SecureStore throws (iOS simulator quirks, Android keystore
 *  unavailable), returns a freshly-generated ephemeral keypair and flips
 *  `swarmStore.keychainEphemeral = true` so the UI can surface a warning
 *  banner. Matches the desktop `DesktopKeychain` fallback strategy. */
export class Keychain implements ForeignKeychainProvider {
  async getOrCreateKeypair(): Promise<ArrayBuffer> {
    try {
      const existing = await SecureStore.getItemAsync(KEYPAIR_KEY);
      if (existing !== null) {
        return base64ToArrayBuffer(existing);
      }
      const fresh = generateKeypairBytes();
      await SecureStore.setItemAsync(KEYPAIR_KEY, arrayBufferToBase64(fresh));
      return fresh;
    } catch (err) {
      // SecureStore unavailable — app still needs to boot, so generate an
      // ephemeral keypair that lives for this process only.
      console.warn("[keychain] SecureStore unavailable, falling back to ephemeral keypair:", err);
      useSwarmStore.getState().setKeychainEphemeral(true);
      return generateKeypairBytes();
    }
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
