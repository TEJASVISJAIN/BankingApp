import { Injectable } from '@nestjs/common';
import { secureLogger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ArtifactMetadata {
  id: string;
  type: 'report' | 'trace' | 'log' | 'export';
  name: string;
  size: number;
  mimeType: string;
  createdAt: Date;
  tags: string[];
  metadata: any;
}

@Injectable()
export class ObjectStoreService {
  private readonly storagePath: string;

  constructor() {
    this.storagePath = path.join(process.cwd(), 'storage', 'artifacts');
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  async saveArtifact(
    data: Buffer | string,
    type: 'report' | 'trace' | 'log' | 'export',
    name: string,
    tags: string[] = [],
    metadata: any = {}
  ): Promise<ArtifactMetadata> {
    try {
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${type}_${timestamp}_${id}`;
      const filePath = path.join(this.storagePath, fileName);

      // Convert string to buffer if needed
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');

      // Write file
      fs.writeFileSync(filePath, buffer);

      const artifactMetadata: ArtifactMetadata = {
        id,
        type,
        name,
        size: buffer.length,
        mimeType: this.getMimeType(type),
        createdAt: new Date(),
        tags,
        metadata: {
          ...metadata,
          filePath,
          fileName,
        },
      };

      // Save metadata
      await this.saveMetadata(artifactMetadata);

      secureLogger.info('Artifact saved', { id, type, name, size: buffer.length });
      return artifactMetadata;
    } catch (error) {
      secureLogger.error('Failed to save artifact', { type, name, error: error.message });
      throw error;
    }
  }

  async getArtifact(id: string): Promise<{ data: Buffer; metadata: ArtifactMetadata } | null> {
    try {
      const metadata = await this.getMetadata(id);
      if (!metadata) {
        return null;
      }

      const filePath = metadata.metadata.filePath;
      if (!fs.existsSync(filePath)) {
        secureLogger.warn('Artifact file not found', { id, filePath });
        return null;
      }

      const data = fs.readFileSync(filePath);
      return { data, metadata };
    } catch (error) {
      secureLogger.error('Failed to get artifact', { id, error: error.message });
      return null;
    }
  }

  async deleteArtifact(id: string): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(id);
      if (!metadata) {
        return false;
      }

      const filePath = metadata.metadata.filePath;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete metadata
      await this.deleteMetadata(id);

      secureLogger.info('Artifact deleted', { id });
      return true;
    } catch (error) {
      secureLogger.error('Failed to delete artifact', { id, error: error.message });
      return false;
    }
  }

  async listArtifacts(
    type?: string,
    tags?: string[],
    limit: number = 100,
    offset: number = 0
  ): Promise<ArtifactMetadata[]> {
    try {
      const metadataPath = path.join(this.storagePath, 'metadata.json');
      
      if (!fs.existsSync(metadataPath)) {
        return [];
      }

      const metadataContent = fs.readFileSync(metadataPath, 'utf8');
      const allArtifacts: ArtifactMetadata[] = JSON.parse(metadataContent);

      let filteredArtifacts = allArtifacts;

      // Filter by type
      if (type) {
        filteredArtifacts = filteredArtifacts.filter(artifact => artifact.type === type);
      }

      // Filter by tags
      if (tags && tags.length > 0) {
        filteredArtifacts = filteredArtifacts.filter(artifact =>
          tags.some(tag => artifact.tags.includes(tag))
        );
      }

      // Sort by creation date (newest first)
      filteredArtifacts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply pagination
      return filteredArtifacts.slice(offset, offset + limit);
    } catch (error) {
      secureLogger.error('Failed to list artifacts', { type, tags, error: error.message });
      return [];
    }
  }

  async saveTrace(sessionId: string, traceData: any): Promise<ArtifactMetadata> {
    const traceJson = JSON.stringify(traceData, null, 2);
    return this.saveArtifact(
      traceJson,
      'trace',
      `trace_${sessionId}`,
      ['trace', 'session', sessionId],
      { sessionId, traceType: 'agent_execution' }
    );
  }

  async saveReport(reportData: any, reportName: string): Promise<ArtifactMetadata> {
    const reportJson = JSON.stringify(reportData, null, 2);
    return this.saveArtifact(
      reportJson,
      'report',
      reportName,
      ['report', 'analytics'],
      { reportType: 'analytics' }
    );
  }

  async exportData(data: any[], exportName: string, format: 'json' | 'csv' = 'json'): Promise<ArtifactMetadata> {
    let exportContent: string;
    let mimeType: string;

    if (format === 'csv') {
      // Convert to CSV
      const headers = Object.keys(data[0] || {});
      const csvRows = [headers.join(',')];
      
      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        });
        csvRows.push(values.join(','));
      });
      
      exportContent = csvRows.join('\n');
      mimeType = 'text/csv';
    } else {
      exportContent = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
    }

    return this.saveArtifact(
      exportContent,
      'export',
      exportName,
      ['export', format],
      { exportFormat: format, recordCount: data.length }
    );
  }

  private async saveMetadata(metadata: ArtifactMetadata): Promise<void> {
    const metadataPath = path.join(this.storagePath, 'metadata.json');
    
    let allMetadata: ArtifactMetadata[] = [];
    if (fs.existsSync(metadataPath)) {
      const content = fs.readFileSync(metadataPath, 'utf8');
      allMetadata = JSON.parse(content);
    }

    // Remove existing metadata for this ID
    allMetadata = allMetadata.filter(m => m.id !== metadata.id);
    
    // Add new metadata
    allMetadata.push(metadata);

    fs.writeFileSync(metadataPath, JSON.stringify(allMetadata, null, 2));
  }

  private async getMetadata(id: string): Promise<ArtifactMetadata | null> {
    const metadataPath = path.join(this.storagePath, 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    const content = fs.readFileSync(metadataPath, 'utf8');
    const allMetadata: ArtifactMetadata[] = JSON.parse(content);
    
    return allMetadata.find(m => m.id === id) || null;
  }

  private async deleteMetadata(id: string): Promise<void> {
    const metadataPath = path.join(this.storagePath, 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return;
    }

    const content = fs.readFileSync(metadataPath, 'utf8');
    const allMetadata: ArtifactMetadata[] = JSON.parse(content);
    
    const filteredMetadata = allMetadata.filter(m => m.id !== id);
    fs.writeFileSync(metadataPath, JSON.stringify(filteredMetadata, null, 2));
  }

  private getMimeType(type: string): string {
    const mimeTypes: { [key: string]: string } = {
      'report': 'application/json',
      'trace': 'application/json',
      'log': 'text/plain',
      'export': 'application/json',
    };
    
    return mimeTypes[type] || 'application/octet-stream';
  }

  async getStorageStats(): Promise<{
    totalArtifacts: number;
    totalSize: number;
    byType: { [key: string]: { count: number; size: number } };
  }> {
    try {
      const artifacts = await this.listArtifacts();
      
      const stats = {
        totalArtifacts: artifacts.length,
        totalSize: artifacts.reduce((sum, artifact) => sum + artifact.size, 0),
        byType: {} as { [key: string]: { count: number; size: number } },
      };

      artifacts.forEach(artifact => {
        if (!stats.byType[artifact.type]) {
          stats.byType[artifact.type] = { count: 0, size: 0 };
        }
        stats.byType[artifact.type].count++;
        stats.byType[artifact.type].size += artifact.size;
      });

      return stats;
    } catch (error) {
      secureLogger.error('Failed to get storage stats', { error: error.message });
      return { totalArtifacts: 0, totalSize: 0, byType: {} };
    }
  }
}
