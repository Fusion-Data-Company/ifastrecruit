import { ApifyClient } from 'apify-client';

export class ApifyService {
  private client: any;
  private isConnected: boolean = false;

  constructor() {
    if (process.env.APIFY_API_TOKEN) {
      this.client = new ApifyClient({
        token: process.env.APIFY_API_TOKEN,
      });
      this.isConnected = true;
    } else {
      console.warn('APIFY_API_TOKEN not provided. Apify functionality will be limited.');
      this.isConnected = false;
    }
  }

  async listActors() {
    if (!this.isConnected) {
      throw new Error('Apify client not connected. Please provide APIFY_API_TOKEN.');
    }

    try {
      const { data } = await this.client.actors().list();
      return data.items.map((actor: any) => ({
        id: actor.id,
        name: actor.name,
        description: actor.description,
        username: actor.username,
        createdAt: actor.createdAt,
        modifiedAt: actor.modifiedAt,
        stats: actor.stats,
        isPublic: actor.isPublic,
        versions: actor.versions,
      }));
    } catch (error) {
      console.error('Failed to list Apify actors:', error);
      throw new Error('Failed to fetch actors from Apify');
    }
  }

  async createActor(actorData: {
    name: string;
    description?: string;
    isPublic?: boolean;
    sourceFiles?: Record<string, string>;
  }) {
    if (!this.isConnected) {
      throw new Error('Apify client not connected. Please provide APIFY_API_TOKEN.');
    }

    try {
      const actor = await this.client.actors().create({
        name: actorData.name,
        description: actorData.description,
        isPublic: actorData.isPublic || false,
        sourceFiles: actorData.sourceFiles || {
          'main.js': `
import { Actor } from 'apify';
import { CheerioCrawler } from 'crawlee';

await Actor.init();

const input = await Actor.getInput() || {};
console.log('Input:', input);

const crawler = new CheerioCrawler({
  async requestHandler({ request, $ }) {
    const title = $('title').text();
    await Actor.pushData({
      url: request.loadedUrl,
      title: title,
      timestamp: new Date().toISOString(),
    });
  },
});

await crawler.run([input.startUrl || 'https://example.com']);
await Actor.exit();
          `.trim(),
          'package.json': JSON.stringify({
            name: actorData.name.toLowerCase().replace(/\s+/g, '-'),
            version: '1.0.0',
            type: 'module',
            dependencies: {
              apify: '^3.0.0',
              crawlee: '^3.0.0',
            },
          }, null, 2),
          'INPUT_SCHEMA.json': JSON.stringify({
            title: 'Input schema',
            type: 'object',
            schemaVersion: 1,
            properties: {
              startUrl: {
                title: 'Start URL',
                type: 'string',
                description: 'The URL to start crawling from',
                default: 'https://example.com',
                editor: 'textfield',
              },
            },
            required: ['startUrl'],
          }, null, 2),
        },
      });

      return actor;
    } catch (error) {
      console.error('Failed to create Apify actor:', error);
      throw new Error('Failed to create actor on Apify platform');
    }
  }

  async runActor(actorId: string, input: any) {
    if (!this.isConnected) {
      throw new Error('Apify client not connected. Please provide APIFY_API_TOKEN.');
    }

    try {
      const run = await this.client.actor(actorId).call(input);
      return {
        id: run.id,
        actorId: run.actorId,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        buildId: run.buildId,
        exitCode: run.exitCode,
        defaultDatasetId: run.defaultDatasetId,
        defaultKeyValueStoreId: run.defaultKeyValueStoreId,
        stats: run.stats,
        meta: run.meta,
        input: run.input,
      };
    } catch (error) {
      console.error('Failed to run Apify actor:', error);
      throw new Error('Failed to start actor run');
    }
  }

  async getRunStatus(runId: string) {
    if (!this.isConnected) {
      throw new Error('Apify client not connected. Please provide APIFY_API_TOKEN.');
    }

    try {
      const run = await this.client.run(runId).get();
      return {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        stats: run.stats,
        exitCode: run.exitCode,
        defaultDatasetId: run.defaultDatasetId,
        output: run.output,
      };
    } catch (error) {
      console.error('Failed to get run status:', error);
      throw new Error('Failed to fetch run status');
    }
  }

  async getDatasetItems(datasetId: string, options: { limit?: number; offset?: number } = {}) {
    if (!this.isConnected) {
      throw new Error('Apify client not connected. Please provide APIFY_API_TOKEN.');
    }

    try {
      const { items } = await this.client.dataset(datasetId).listItems({
        limit: options.limit || 100,
        offset: options.offset || 0,
      });
      return items;
    } catch (error) {
      console.error('Failed to get dataset items:', error);
      throw new Error('Failed to fetch dataset items');
    }
  }

  async getActorRuns(actorId: string) {
    if (!this.isConnected) {
      throw new Error('Apify client not connected. Please provide APIFY_API_TOKEN.');
    }

    try {
      const { data } = await this.client.actor(actorId).runs().list();
      return data.items.map((run: any) => ({
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        stats: run.stats,
        defaultDatasetId: run.defaultDatasetId,
        exitCode: run.exitCode,
      }));
    } catch (error) {
      console.error('Failed to get actor runs:', error);
      throw new Error('Failed to fetch actor runs');
    }
  }

  async waitForRunCompletion(runId: string, timeoutMs: number = 300000) {
    if (!this.isConnected) {
      throw new Error('Apify client not connected. Please provide APIFY_API_TOKEN.');
    }

    try {
      const run = await this.client.run(runId).waitForFinish({ waitSecs: timeoutMs / 1000 });
      return {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        stats: run.stats,
        defaultDatasetId: run.defaultDatasetId,
        exitCode: run.exitCode,
        output: run.output,
      };
    } catch (error) {
      console.error('Failed to wait for run completion:', error);
      throw new Error('Failed to wait for run completion');
    }
  }

  isApiConnected(): boolean {
    return this.isConnected;
  }
}

export const apifyService = new ApifyService();