/// Relative paths under Application Support for the on-device Hermes home.
abstract final class HermesHomePaths {
  static const rootDir = 'hermes_home';

  static const noBundledSkillsFile = 'hermes_home/.no-bundled-skills';
  static const configFile = 'hermes_home/config.yaml';
  static const agentsFile = 'hermes_home/AGENTS.md';
  static const soulFile = 'hermes_home/SOUL.md';
  static const identityFile = 'hermes_home/identity.json';
  static const vaultIndexFile = 'hermes_home/vault_index.json';
  static const docsDir = 'hermes_home/docs';
  static const docsIndexFile = 'hermes_home/docs/_index.json';
  static const revisionsDir = 'hermes_home/revisions';
  static const inboxDir = 'hermes_home/inbox';
  static const inboxFilesDir = 'hermes_home/inbox/files';
  static const inboxMessagesFile = 'hermes_home/inbox/messages.json';
  static const skillsDir = 'hermes_home/skills';
  static const skillsManifestFile = 'hermes_home/skills/_manifest.json';
  static const cronDir = 'hermes_home/cron';
  static const chatDir = 'hermes_home/chat';
  static const chatHistoryFile = 'hermes_home/chat/history.json';
  static const logFile = 'hermes_home/log/agent.jsonl';

  static const retirementDocId = 'retirement';
  static const protocolVersion = 1;
  static const maxRevisionsKept = 50;
}
