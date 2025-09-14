import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { ObjectStorageService } from "../objectStorage";

export interface StoredFile {
  id: string;
  originalUrl: string;
  localPath: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface FileDownloadResult {
  success: boolean;
  file?: StoredFile;
  error?: string;
}

export class FileStorageService {
  private objectStorage: ObjectStorageService;
  private localStorageDir: string;

  constructor() {
    this.objectStorage = new ObjectStorageService();
    this.localStorageDir = process.env.LOCAL_FILE_STORAGE_DIR || "/tmp/elevenlabs-files";
    this.ensureStorageDirectoryExists();
  }

  private async ensureStorageDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.localStorageDir, { recursive: true });
      await fs.mkdir(join(this.localStorageDir, "audio"), { recursive: true });
      await fs.mkdir(join(this.localStorageDir, "transcripts"), { recursive: true });
    } catch (error) {
      console.error("Failed to create storage directories:", error);
    }
  }

  /**
   * Download an audio recording from ElevenLabs and store it locally
   */
  async downloadAudioRecording(audioUrl: string, candidateId: string): Promise<FileDownloadResult> {
    try {
      console.log(`[File Storage] Downloading audio recording from: ${audioUrl}`);
      
      // Convert relative URL to absolute URL if needed
      let fullUrl = audioUrl;
      if (audioUrl.startsWith('/')) {
        const baseUrl = process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.replit.app`
          : 'http://localhost:5000';
        fullUrl = `${baseUrl}${audioUrl}`;
        console.log(`[File Storage] Converting relative URL to absolute: ${fullUrl}`);
      }
      
      // Download the audio file
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const fileId = randomUUID();
      const filename = `audio_${candidateId}_${fileId}.mp3`;
      const localPath = join(this.localStorageDir, "audio", filename);

      // Save to local filesystem
      await fs.writeFile(localPath, buffer);

      const file: StoredFile = {
        id: fileId,
        originalUrl: audioUrl,
        localPath,
        filename,
        mimeType: response.headers.get("content-type") || "audio/mpeg",
        size: buffer.length,
        createdAt: new Date()
      };

      console.log(`[File Storage] Audio recording saved locally: ${filename} (${file.size} bytes)`);
      return { success: true, file };

    } catch (error) {
      console.error(`[File Storage] Failed to download audio recording:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  /**
   * Store a transcript as a text file
   */
  async storeTranscript(transcript: string, candidateId: string, conversationId: string): Promise<FileDownloadResult> {
    try {
      const fileId = randomUUID();
      const filename = `transcript_${candidateId}_${conversationId}_${fileId}.txt`;
      const localPath = join(this.localStorageDir, "transcripts", filename);

      // The transcript should already be formatted as plain text from the ElevenLabs agent
      // Add a header for better readability
      let transcriptText = `=== Interview Transcript ===\n`;
      transcriptText += `Conversation ID: ${conversationId}\n`;
      transcriptText += `Generated: ${new Date().toLocaleString()}\n`;
      transcriptText += `${'='.repeat(30)}\n\n`;
      transcriptText += transcript;

      // Ensure the transcript ends with a newline
      if (!transcriptText.endsWith('\n')) {
        transcriptText += '\n';
      }

      await fs.writeFile(localPath, transcriptText, 'utf8');

      const file: StoredFile = {
        id: fileId,
        originalUrl: "", // No original URL for transcripts
        localPath,
        filename,
        mimeType: "text/plain",
        size: Buffer.byteLength(transcriptText, 'utf8'),
        createdAt: new Date()
      };

      console.log(`[File Storage] Transcript saved locally: ${filename} (${file.size} bytes)`);
      return { success: true, file };

    } catch (error) {
      console.error(`[File Storage] Failed to store transcript:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  /**
   * Get a stored file by ID
   */
  async getFile(fileId: string, type: "audio" | "transcript"): Promise<StoredFile | null> {
    try {
      const directory = join(this.localStorageDir, type === "audio" ? "audio" : "transcripts");
      const files = await fs.readdir(directory);
      
      const filePattern = type === "audio" ? `audio_*_${fileId}.mp3` : `transcript_*_${fileId}.txt`;
      const filename = files.find(f => f.includes(fileId));
      
      if (!filename) {
        return null;
      }

      const localPath = join(directory, filename);
      const stats = await fs.stat(localPath);

      return {
        id: fileId,
        originalUrl: "",
        localPath,
        filename,
        mimeType: type === "audio" ? "audio/mpeg" : "text/plain",
        size: stats.size,
        createdAt: stats.birthtime
      };

    } catch (error) {
      console.error(`[File Storage] Failed to get file ${fileId}:`, error);
      return null;
    }
  }

  /**
   * Read file content (useful for serving files)
   */
  async readFile(localPath: string): Promise<Buffer> {
    return fs.readFile(localPath);
  }

  /**
   * Check if file exists
   */
  async fileExists(localPath: string): Promise<boolean> {
    try {
      await fs.access(localPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a stored file
   */
  async deleteFile(localPath: string): Promise<boolean> {
    try {
      await fs.unlink(localPath);
      console.log(`[File Storage] Deleted file: ${localPath}`);
      return true;
    } catch (error) {
      console.error(`[File Storage] Failed to delete file ${localPath}:`, error);
      return false;
    }
  }

  /**
   * Clean up old files (older than specified days)
   */
  async cleanupOldFiles(olderThanDays: number = 30): Promise<number> {
    let deletedCount = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      const directories = ["audio", "transcripts"];
      
      for (const dir of directories) {
        const dirPath = join(this.localStorageDir, dir);
        const files = await fs.readdir(dirPath);
        
        for (const filename of files) {
          const filePath = join(dirPath, filename);
          const stats = await fs.stat(filePath);
          
          if (stats.birthtime < cutoffDate) {
            await this.deleteFile(filePath);
            deletedCount++;
          }
        }
      }

      console.log(`[File Storage] Cleaned up ${deletedCount} old files`);
    } catch (error) {
      console.error(`[File Storage] Failed to cleanup old files:`, error);
    }

    return deletedCount;
  }

  /**
   * Upload file to object storage and return path
   */
  async uploadToObjectStorage(localPath: string, filename: string): Promise<string | null> {
    try {
      // Get upload URL
      const uploadUrl = await this.objectStorage.getObjectEntityUploadURL();
      
      // Read file content
      const fileBuffer = await this.readFile(localPath);
      
      // Upload to object storage
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: fileBuffer,
        headers: {
          'Content-Type': localPath.endsWith('.mp3') ? 'audio/mpeg' : 'text/plain'
        }
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      // Extract object path from upload URL
      const url = new URL(uploadUrl);
      const objectPath = url.pathname;
      
      console.log(`[File Storage] Uploaded ${filename} to object storage: ${objectPath}`);
      return objectPath;

    } catch (error) {
      console.error(`[File Storage] Failed to upload to object storage:`, error);
      return null;
    }
  }
}

export const fileStorageService = new FileStorageService();