/**
 * Slash Command Processor
 *
 * Handles /command syntax in messages
 */

interface SlashCommand {
  command: string;
  description: string;
  handler: (args: string[], context: any) => Promise<string>;
}

export class SlashCommandProcessor {
  private commands: Map<string, SlashCommand>;

  constructor() {
    this.commands = new Map();
    this.registerCommands();
  }

  private registerCommands() {
    this.commands.set('ask', {
      command: '/ask',
      description: 'Ask Jason AI a question',
      handler: async (args, context) => {
        const question = args.join(' ');
        if (!question) {
          return 'Usage: /ask [your question]\nExample: /ask How do I get licensed?';
        }
        // The actual AI response will be handled by the normal @Jason mention flow
        // This just formats the message to trigger Jason
        return `@Jason ${question}`;
      },
    });

    this.commands.set('jason', {
      command: '/jason',
      description: 'Talk to Jason AI (alias for /ask)',
      handler: async (args, context) => {
        return this.commands.get('ask')!.handler(args, context);
      },
    });

    this.commands.set('help', {
      command: '/help',
      description: 'Show available commands',
      handler: async () => {
        const commandList = Array.from(this.commands.values())
          .map(cmd => `**${cmd.command}** - ${cmd.description}`)
          .join('\n');
        return `**Available Commands:**\n${commandList}`;
      },
    });
  }

  async process(message: string, context: any): Promise<string | null> {
    if (!message.startsWith('/')) return null;

    const parts = message.slice(1).split(' ');
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const command = this.commands.get(commandName);
    if (!command) {
      return `Unknown command: /${commandName}. Type /help for available commands.`;
    }

    return await command.handler(args, context);
  }

  getCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }
}

export const slashCommands = new SlashCommandProcessor();
