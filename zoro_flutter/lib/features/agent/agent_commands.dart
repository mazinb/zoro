import 'package:flutter/material.dart';

/// Telegram-style slash command surfaced in the composer menu and in the
/// autocomplete list while typing `/`.
class AgentCommand {
  const AgentCommand({
    required this.name,
    required this.description,
    required this.icon,
  });

  /// Command without the leading slash.
  final String name;
  final String description;
  final IconData icon;

  String get slash => '/$name';
}

abstract final class AgentCommands {
  static const all = <AgentCommand>[
    AgentCommand(
      name: 'plan',
      description: 'Open the retirement plan your agent reads',
      icon: Icons.description_outlined,
    ),
    AgentCommand(
      name: 'inbox',
      description: 'PDFs stored on this phone',
      icon: Icons.inbox_outlined,
    ),
    AgentCommand(
      name: 'mailbox',
      description: 'Private mailbox address and keys',
      icon: Icons.alternate_email,
    ),
    AgentCommand(
      name: 'fetch',
      description: 'Check the mailbox for new PDFs',
      icon: Icons.sync,
    ),
    AgentCommand(
      name: 'import',
      description: 'Add a PDF from this device',
      icon: Icons.note_add_outlined,
    ),
    AgentCommand(
      name: 'clear',
      description: 'Delete this conversation from the phone',
      icon: Icons.delete_sweep_outlined,
    ),
    AgentCommand(
      name: 'skills',
      description: 'List on-device skill packs',
      icon: Icons.extension_outlined,
    ),
    AgentCommand(
      name: 'help',
      description: 'What the agent can do',
      icon: Icons.help_outline,
    ),
  ];

  /// Commands whose name starts with the text typed after `/`.
  static List<AgentCommand> matching(String query) {
    final q = query.trim().toLowerCase();
    if (!q.startsWith('/')) return const [];
    final term = q.substring(1);
    return [
      for (final c in all)
        if (term.isEmpty || c.name.startsWith(term)) c,
    ];
  }

  static AgentCommand? exact(String text) {
    final t = text.trim().toLowerCase();
    if (!t.startsWith('/')) return null;
    final name = t.substring(1).split(RegExp(r'\s+')).first;
    for (final c in all) {
      if (c.name == name) return c;
    }
    return null;
  }

  static String helpText() {
    final lines = [for (final c in all) '${c.slash} — ${c.description}'];
    return 'I keep everything on this phone. Commands:\n\n${lines.join('\n')}\n\nOr just ask about your plan, statements, or next financial move.';
  }
}
