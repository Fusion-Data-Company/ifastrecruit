// Desktop Notifications Manager
interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
}

class DesktopNotificationManager {
  private permission: NotificationPermission = 'default';
  private enabled: boolean = true;

  constructor() {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('Desktop notifications are not supported in this browser');
      return;
    }

    this.permission = Notification.permission;
    this.enabled = localStorage.getItem('desktop_notifications_enabled') !== 'false';
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    // If already granted or denied, return current permission
    if (Notification.permission !== 'default') {
      this.permission = Notification.permission;
      return this.permission;
    }

    // Request permission
    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  async show(options: NotificationOptions): Promise<Notification | null> {
    // Check if enabled and have permission
    if (!this.enabled || !this.isSupported()) {
      return null;
    }

    // Check if document is visible (tab is active)
    if (document.visibilityState === 'visible') {
      // Don't show notification if tab is active
      return null;
    }

    // Request permission if not yet granted
    if (this.permission === 'default') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        return null;
      }
    }

    if (this.permission !== 'granted') {
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag, // Prevents duplicate notifications with same tag
        data: options.data,
        requireInteraction: options.requireInteraction || false,
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle click - focus window and navigate
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        notification.close();

        // Navigate if data contains URL
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  showMessageNotification(type: 'message' | 'mention' | 'dm', senderName: string, content: string, url?: string) {
    const titles = {
      message: `New message from ${senderName}`,
      mention: `${senderName} mentioned you`,
      dm: `${senderName} sent you a direct message`
    };

    this.show({
      title: titles[type],
      body: content,
      tag: `${type}-${Date.now()}`, // Unique tag to prevent grouping
      data: { url }
    });
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('desktop_notifications_enabled', String(enabled));
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isSupported(): boolean {
    return 'Notification' in window;
  }

  hasPermission(): boolean {
    return this.permission === 'granted';
  }

  getPermission(): NotificationPermission {
    return this.permission;
  }
}

// Export singleton instance
export const desktopNotifications = new DesktopNotificationManager();