export class PublishAiWeeklyBriefingCommand {
  constructor(
    public readonly round?: number,
    public readonly force: boolean = false,
  ) {}
}
