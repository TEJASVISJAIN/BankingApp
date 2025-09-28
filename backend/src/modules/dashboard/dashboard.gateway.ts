import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/dashboard',
})
@UseGuards(ApiKeyGuard)
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Set<Socket>();

  handleConnection(client: Socket) {
    console.log(`Dashboard client connected: ${client.id}`);
    this.connectedClients.add(client);
    
    // Send initial data
    client.emit('dashboard_connected', {
      message: 'Connected to dashboard updates',
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`Dashboard client disconnected: ${client.id}`);
    this.connectedClients.delete(client);
  }

  @SubscribeMessage('subscribe_dashboard')
  handleSubscribeDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string }
  ) {
    console.log(`Client ${client.id} subscribed to dashboard updates`);
    client.join('dashboard_updates');
    
    return {
      status: 'subscribed',
      message: 'Successfully subscribed to dashboard updates',
    };
  }

  @SubscribeMessage('unsubscribe_dashboard')
  handleUnsubscribeDashboard(@ConnectedSocket() client: Socket) {
    console.log(`Client ${client.id} unsubscribed from dashboard updates`);
    client.leave('dashboard_updates');
    
    return {
      status: 'unsubscribed',
      message: 'Successfully unsubscribed from dashboard updates',
    };
  }

  // Method to broadcast dashboard updates
  broadcastDashboardUpdate(type: string, data: any) {
    this.server.to('dashboard_updates').emit('dashboard_update', {
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to broadcast new transaction
  broadcastNewTransaction(transaction: any) {
    this.broadcastDashboardUpdate('new_transaction', {
      transaction,
      message: 'New transaction processed',
    });
  }

  // Method to broadcast new dispute
  broadcastNewDispute(dispute: any) {
    this.broadcastDashboardUpdate('new_dispute', {
      dispute,
      message: 'New dispute opened',
    });
  }

  // Method to broadcast KPI updates
  broadcastKpiUpdate(kpis: any) {
    this.broadcastDashboardUpdate('kpi_update', {
      kpis,
      message: 'Dashboard KPIs updated',
    });
  }

  // Method to broadcast fraud alert
  broadcastFraudAlert(alert: any) {
    this.broadcastDashboardUpdate('fraud_alert', {
      alert,
      message: 'New fraud alert detected',
    });
  }
}
