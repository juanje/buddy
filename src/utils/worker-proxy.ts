// src/utils/worker-proxy.ts — WorkerAPI passthrough before connection is ready.

import type { WorkerAPI } from "../../shared/api";
import type { WorkerConnection } from "./agent";

export function createWorkerProxy(getConnection: () => WorkerConnection | undefined): WorkerAPI {
  return {
    async prompt(text, options) {
      await getConnection()?.api.prompt(text, options);
    },
    async abort() {
      await getConnection()?.api.abort();
    },
    async getState() {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.getState();
    },
    async getDeferredItems() {
      const connection = getConnection();
      if (!connection) return [];
      return connection.api.getDeferredItems();
    },
    async dismissDeferredItems() {
      await getConnection()?.api.dismissDeferredItems();
    },
    async getSetupState() {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.getSetupState();
    },
    async checkPrerequisites() {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.checkPrerequisites();
    },
    async getDefaultLocation() {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.getDefaultLocation();
    },
    async validateLocation(path) {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.validateLocation(path);
    },
    async configureProviderKey(provider, apiKey, baseUrl) {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.configureProviderKey(provider, apiKey, baseUrl);
    },
    async loginOAuth(provider) {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.loginOAuth(provider);
    },
    async answerOAuthPrompt(requestId, value) {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.answerOAuthPrompt(requestId, value);
    },
    async cancelOAuthLogin() {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.cancelOAuthLogin();
    },
    async listModels(provider) {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.listModels(provider);
    },
    async getAuthStatus() {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.getAuthStatus();
    },
    async runSetup(config, mode) {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.runSetup(config, mode);
    },
    async resolvePermission(id, allow, persist) {
      await getConnection()?.api.resolvePermission(id, allow, persist);
    },
    async updateConfig(patch) {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.updateConfig(patch);
    },
    async changeModel(provider, model) {
      const connection = getConnection();
      if (!connection) throw new Error("worker not connected");
      return connection.api.changeModel(provider, model);
    },
    async shutdown() {
      await getConnection()?.api.shutdown();
    },
  };
}
