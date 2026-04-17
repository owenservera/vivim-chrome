/**
 * File System Storage Backend
 * Uses File System Access API to store data in user-selected location
 */
export class FileSystemStorageBackend {
  constructor() {
    this.directoryHandle = null;
    this.fileHandle = null;
    this.initialized = false;
  }

  async initialize(config = {}) {
    try {
      // Request directory access from user
      this.directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads'
      });

      // Create or get the data feed file
      this.fileHandle = await this.directoryHandle.getFileHandle('vivim-data-feed.jsonl', {
        create: true
      });

      this.initialized = true;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('User cancelled directory selection');
      }
      throw new Error(`Failed to initialize file system storage: ${error.message}`);
    }
  }

  async store(data) {
    if (!this.initialized || !this.fileHandle) {
      throw new Error('File system backend not initialized');
    }

    try {
      // Get existing file content
      const file = await this.fileHandle.getFile();
      const existingContent = await file.text();

      // Append new data as JSON Lines
      const newContent = data.map(item => JSON.stringify(item)).join('\n') + '\n';
      const fullContent = existingContent + newContent;

      // Write back to file
      const writable = await this.fileHandle.createWritable();
      await writable.write(fullContent);
      await writable.close();
    } catch (error) {
      throw new Error(`Failed to store data: ${error.message}`);
    }
  }

  async export(format = 'json', dateRange = null) {
    if (!this.initialized || !this.fileHandle) {
      throw new Error('File system backend not initialized');
    }

    const file = await this.fileHandle.getFile();
    const content = await file.text();

    if (format === 'json') {
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      const data = lines.map(line => JSON.parse(line));

      // Filter by date range if specified
      if (dateRange) {
        const filtered = data.filter(item => {
          const itemDate = new Date(item.timestamp);
          return itemDate >= dateRange.start && itemDate <= dateRange.end;
        });
        return filtered;
      }

      return data;
    }

    // For other formats, return raw content
    return content;
  }

  async cleanup(cutoffDate) {
    if (!this.initialized || !this.fileHandle) return;

    try {
      const file = await this.fileHandle.getFile();
      const content = await file.text();
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      // Filter out old data
      const filteredLines = lines.filter(line => {
        try {
          const item = JSON.parse(line);
          return item.timestamp >= cutoffDate;
        } catch {
          return false; // Remove malformed lines
        }
      });

      // Write back filtered content
      const newContent = filteredLines.join('\n') + '\n';
      const writable = await this.fileHandle.createWritable();
      await writable.write(newContent);
      await writable.close();
    } catch (error) {
      console.error('Failed to cleanup file system data:', error);
    }
  }
}