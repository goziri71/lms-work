import { StreamClient } from "@stream-io/node-sdk";
import { Config } from "../config/config.js";

class StreamVideoService {
  constructor() {
    this.client = null;
  }

  getClient() {
    if (!this.client) {
      if (!Config.streamApiKey || !Config.streamSecret) {
        console.warn(
          "⚠️ Video calls disabled: STREAM_API_KEY and STREAM_SECRET not configured"
        );
        return null;
      }
      this.client = new StreamClient(Config.streamApiKey, Config.streamSecret);
    }
    return this.client;
  }

  /**
   * Generate a user token for Stream Video
   * @param {string|number} userId - Your app's user ID
   * @param {number} expiresInSeconds - Token TTL (default 1 hour)
   * @returns {string} Stream video token
   */
  generateUserToken(userId, expiresInSeconds = 3600) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return this.getClient().createToken(String(userId), exp);
  }

  /**
   * Create or get a call
   * @param {string} callType - 'lecture' or 'default'
   * @param {string} callId - Unique call identifier
   * @param {object} options - Call settings
   * @returns {Promise<object>} Call metadata
   */
  async getOrCreateCall(callType, callId, options = {}) {
    const call = this.getClient().video.call(callType, callId);

    const settings = {
      data: {
        created_by_id: options.createdBy || "system",
        settings_override: {
          audio: {
            mic_default_on: true,
            speaker_default_on: true,
            default_device: "speaker",
          },
          video: {
            camera_default_on: false,
            enabled: options.audioOnly ? false : true, // Disable video for audio-only calls
            target_resolution: {
              width: 1280,
              height: 720,
            },
          },
          screensharing: {
            enabled: options.audioOnly ? false : true, // Disable screensharing for audio-only
          },
          recording: {
            mode: options.record ? "available" : "disabled",
          },
        },
      },
    };

    if (options.startsAt) {
      settings.data.starts_at = new Date(options.startsAt).toISOString();
    }

    if (options.members) {
      settings.data.members = options.members;
    }

    await call.getOrCreate(settings);
    return call;
  }

  /**
   * End a call
   * @param {string} callType
   * @param {string} callId
   */
  async endCall(callType, callId) {
    const call = this.getClient().video.call(callType, callId);
    await call.end();
  }
}

export const streamVideoService = new StreamVideoService();
