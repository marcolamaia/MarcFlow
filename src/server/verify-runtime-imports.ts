import assert from "node:assert/strict";
import makeWASocket, { initAuthCreds } from "@whiskeysockets/baileys";

// Use the same tsx loader and package scope as the production server.
// Importing Baileys through CommonJS fails on its ESM-only Rust bridge.
assert.equal(typeof makeWASocket, "function");
assert.ok(initAuthCreds().noiseKey.public.length > 0);
console.log("WhatsApp imports work through the production TypeScript loader.");
