export interface WhatsAppMessage {
  id?: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'system';
  instanceId: string;
  messageId?: string;
  status?: string;
  metadata?: any;
}

export interface WhatsAppStatus {
  state: 'connected' | 'disconnected' | 'connecting' | 'require_qr' | 'error';
  description?: string;
  qrCode?: string;
}

export interface WhatsAppConfig {
  instanceId: string;
  apiUrl?: string;
  apiKey?: string;
  [key: string]: any;
}

export interface WhatsAppWebhookConfig {
  url: string;
  events?: string[];
  secret?: string;
}

export interface WhatsAppProvider {
  initialize?(config?: WhatsAppConfig): Promise<any>;
  disconnect(config?: WhatsAppConfig): Promise<WhatsAppStatus>;
  sendMessage(to: string, message: string, config?: WhatsAppConfig): Promise<WhatsAppMessage>;
  sendImage(to: string, imageUrl: string, caption: string, config?: WhatsAppConfig): Promise<WhatsAppMessage>;
  sendDocument(to: string, documentUrl: string, caption: string, config?: WhatsAppConfig): Promise<WhatsAppMessage>;
  sendAudio(to: string, audioUrl: string, config?: WhatsAppConfig): Promise<WhatsAppMessage>;
  sendLocation(to: string, latitude: number, longitude: number, config?: WhatsAppConfig): Promise<WhatsAppMessage>;
  getQRCode?(config?: WhatsAppConfig): Promise<string>;
  updateConfig?(config: WhatsAppConfig): Promise<void>;
  getConfig?(config?: WhatsAppConfig): Promise<any>;
  create?(config: WhatsAppConfig): Promise<WhatsAppStatus>;
  getStatus?(config: WhatsAppConfig): Promise<WhatsAppStatus>;
  delete?(config: WhatsAppConfig): Promise<boolean>;
  configureWebhook?(webhookConfig: WhatsAppWebhookConfig, config: WhatsAppConfig): Promise<boolean>;
  getMediaBase64?(messageId: string, config: WhatsAppConfig): Promise<string | null>;
} 