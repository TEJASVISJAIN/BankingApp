import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect() {
    if (this.socket?.connected) {
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    this.socket = io(`${apiUrl}/dashboard`, {
      auth: {
        'X-API-Key': 'dev_key_789', // Development API key
      },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to dashboard WebSocket');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Subscribe to dashboard updates
      this.socket?.emit('subscribe_dashboard', { userId: 'dashboard_user' });
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from dashboard WebSocket');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    });

    this.socket.on('dashboard_connected', (data) => {
      console.log('Dashboard WebSocket connected:', data);
    });

    this.socket.on('dashboard_update', (data) => {
      console.log('Dashboard update received:', data);
      this.handleDashboardUpdate(data);
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleDashboardUpdate(data: any) {
    // Emit custom events for different update types
    const event = new CustomEvent('dashboard-update', { detail: data });
    window.dispatchEvent(event);
  }

  disconnect() {
    if (this.socket) {
      this.socket.emit('unsubscribe_dashboard');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Method to listen for specific update types
  onUpdate(callback: (data: any) => void) {
    const handler = (event: CustomEvent) => {
      callback(event.detail);
    };
    
    window.addEventListener('dashboard-update', handler as EventListener);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('dashboard-update', handler as EventListener);
    };
  }

  // Method to listen for specific update types
  onNewTransaction(callback: (transaction: any) => void) {
    return this.onUpdate((data) => {
      if (data.type === 'new_transaction') {
        callback(data.data.transaction);
      }
    });
  }

  onNewDispute(callback: (dispute: any) => void) {
    return this.onUpdate((data) => {
      if (data.type === 'new_dispute') {
        callback(data.data.dispute);
      }
    });
  }

  onKpiUpdate(callback: (kpis: any) => void) {
    return this.onUpdate((data) => {
      if (data.type === 'kpi_update') {
        callback(data.data.kpis);
      }
    });
  }

  onFraudAlert(callback: (alert: any) => void) {
    return this.onUpdate((data) => {
      if (data.type === 'fraud_alert') {
        callback(data.data.alert);
      }
    });
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

export default new WebSocketService();
