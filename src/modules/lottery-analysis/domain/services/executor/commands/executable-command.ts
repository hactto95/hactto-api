export interface ExecutableCommand {
  execute(): Promise<number[]>;
}
