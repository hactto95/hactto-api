import { ExecutableCommand } from './commands/executable-command';

export async function hacttoExecute(
  command: ExecutableCommand,
): Promise<number[]> {
  return await command.execute();
}
