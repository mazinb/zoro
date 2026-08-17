import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/agent/agent_chat_service.dart';
import '../../core/agent/chat_history_store.dart';
import '../../core/agent/hermes_adapter.dart';
import '../../core/agent/inbox_store.dart';
import '../../core/agent/mcp/zoro_mcp_tools.dart';
import '../../core/agent/pdf_unlock.dart';
import '../../core/agent/skill_pack.dart';
import '../../core/llm/llm_client.dart';
import '../../core/llm/llm_consent_gate.dart';
import '../../core/state/app_model.dart';
import '../../shared/help/tab_help_content.dart';
import '../../shared/widgets/tab_header_actions.dart';
import '../goals/goals_ai_flow.dart';
import 'agent_commands.dart';
import 'mailbox_claim_page.dart';
import 'retirement_plan_editor_page.dart';
import 'vault_password_sheet.dart';

class AgentTab extends StatefulWidget {
  const AgentTab({
    super.key,
    required this.model,
    this.pendingOpenHelper = false,
    this.onPendingOpenHelperHandled,
  });

  final AppModel model;
  final bool pendingOpenHelper;
  final VoidCallback? onPendingOpenHelperHandled;

  @override
  State<AgentTab> createState() => AgentTabState();
}

class AgentTabState extends State<AgentTab> {
  static const _stallTimeout = Duration(seconds: 28);

  static const _welcome =
      'I’m your private on-device financial agent. Ask me about your plan, '
      'statements, or next financial action. Type / for commands.';

  final _composer = TextEditingController();
  final _composerFocus = FocusNode();
  final _chatScroll = ScrollController();
  Timer? _stallTimer;
  bool _fetching = false;
  bool _sending = false;
  bool _historyLoaded = false;
  String? _status;
  List<InboxItem> _inbox = [];
  List<AgentCommand> _commandMatches = const [];
  final List<_ChatMessage> _messages = [];

  void openHelperHub() {
    openGoalsAiAssistant(context: context, model: widget.model);
  }

  @override
  void initState() {
    super.initState();
    if (widget.pendingOpenHelper) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        openHelperHub();
        widget.onPendingOpenHelperHandled?.call();
      });
    }
    _composer.addListener(_onComposerChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_loadHistory());
      unawaited(_loadInbox());
      unawaited(widget.model.refreshAppleFoundationCapabilities());
      if (widget.model.agentWorkspace.hasMailbox) {
        unawaited(_refreshMailbox(quiet: true));
      }
      unawaited(_runPendingHermesJob());
    });
  }

  Future<void> _runPendingHermesJob() async {
    final jobId = widget.model.pendingHermesCronJobId;
    if (jobId == null || jobId.isEmpty) return;
    widget.model.pendingHermesCronJobId = null;
    if (!widget.model.agentWorkspace.hermesStatus.isReady) {
      _addLocalTurn(
        fromAgent: true,
        text:
            'Scheduled job "$jobId" is due. The on-device runtime is not installed yet.',
      );
      return;
    }
    final result = await widget.model.agentWorkspace.hermes.run(
      HermesRunRequest(
        hermesHomePath: widget.model.agentWorkspace.home.path,
        cronJobId: jobId,
        enabledSkillIds: const [],
        grantedTools: ZoroMcpTools.toolNames,
      ),
    );
    _addLocalTurn(
      fromAgent: true,
      text: result.message.trim().isEmpty
          ? (result.ok ? 'Job $jobId finished.' : 'Job $jobId failed.')
          : result.message,
    );
  }

  void _onComposerChanged() {
    final matches = AgentCommands.matching(_composer.text);
    if (matches.length == _commandMatches.length &&
        (matches.isEmpty || matches.first.name == _commandMatches.first.name)) {
      return;
    }
    setState(() => _commandMatches = matches);
  }

  Future<void> _loadHistory() async {
    final store = widget.model.agentWorkspace.chatHistory;
    final turns = await store?.load() ?? const <ChatTurn>[];
    if (!mounted) return;
    setState(() {
      _historyLoaded = true;
      _messages
        ..clear()
        ..addAll([
          for (final t in turns)
            _ChatMessage(
              fromAgent: t.fromAgent,
              text: t.text,
              status: t.failed ? AgentTurnStatus.failed : AgentTurnStatus.done,
              startedAt: t.at.toLocal(),
            ),
        ]);
    });
  }

  Future<void> _persistHistory() async {
    final store = widget.model.agentWorkspace.chatHistory;
    if (store == null) return;
    await store.save([
      for (final m in _messages)
        if (m.status == AgentTurnStatus.done ||
            m.status == AgentTurnStatus.failed)
          ChatTurn(
            fromAgent: m.fromAgent,
            text: m.text,
            at: (m.startedAt ?? DateTime.now()).toUtc(),
            failed: m.status == AgentTurnStatus.failed,
          ),
    ]);
  }

  Future<void> _clearHistory() async {
    await widget.model.agentWorkspace.chatHistory?.clear();
    if (!mounted) return;
    setState(() {
      _messages.clear();
      _status = 'Conversation deleted from this phone.';
    });
  }

  void _addLocalTurn({required bool fromAgent, required String text}) {
    setState(() {
      _messages.add(
        _ChatMessage(
          fromAgent: fromAgent,
          text: text,
          status: AgentTurnStatus.done,
          startedAt: DateTime.now(),
        ),
      );
    });
    _scrollChatToEnd();
    unawaited(_persistHistory());
  }

  /// Runs a slash command locally. Commands never spend tokens.
  Future<void> _runCommand(AgentCommand command, {bool echo = true}) async {
    _composer.clear();
    setState(() => _commandMatches = const []);
    if (echo) _addLocalTurn(fromAgent: false, text: command.slash);

    switch (command.name) {
      case 'plan':
        _openPlan();
      case 'inbox':
        _showInbox();
      case 'mailbox':
        _showMailbox();
      case 'fetch':
        if (!widget.model.agentWorkspace.hasMailbox) {
          _addLocalTurn(
            fromAgent: true,
            text: 'No mailbox yet. Claim an email address first.',
          );
          await _openClaim();
          return;
        }
        await _refreshMailbox();
        _addLocalTurn(
          fromAgent: true,
          text: _inbox.isEmpty
              ? 'Mailbox checked. Nothing new.'
              : 'Mailbox checked. ${_inbox.length} PDF(s) on this phone.',
        );
      case 'import':
        await _pickPdf();
      case 'clear':
        await _clearHistory();
      case 'skills':
        final names = [
          for (final id in SkillPack.bundledIds)
            if (widget.model.agentWorkspace.hasSkill(id)) id,
        ];
        _addLocalTurn(
          fromAgent: true,
          text: names.isEmpty
              ? 'No skill packs on this phone yet.'
              : 'On-device skills:\n${names.map((n) => '• $n').join('\n')}',
        );
      case 'help':
        _addLocalTurn(fromAgent: true, text: AgentCommands.helpText());
    }
  }

  void _showCommandMenu() {
    _dismissKeyboard();
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      // The full command list is taller than the default sheet height.
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.7,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 0, 20, 4),
                child: Text(
                  'Commands',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.only(bottom: 8),
                  children: [
                    for (final c in AgentCommands.all)
                      ListTile(
                        dense: true,
                        visualDensity: VisualDensity.compact,
                        leading: Icon(
                          c.icon,
                          size: 20,
                          color: widget.model.accent,
                        ),
                        title: Text(
                          c.slash,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          c.description,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        onTap: () {
                          Navigator.pop(context);
                          unawaited(_runCommand(c));
                        },
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void didUpdateWidget(AgentTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.pendingOpenHelper && !oldWidget.pendingOpenHelper) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        openHelperHub();
        widget.onPendingOpenHelperHandled?.call();
      });
    }
  }

  @override
  void dispose() {
    _stallTimer?.cancel();
    _composer.removeListener(_onComposerChanged);
    _composer.dispose();
    _composerFocus.dispose();
    _chatScroll.dispose();
    super.dispose();
  }

  void _dismissKeyboard() => _composerFocus.unfocus();

  void _scrollChatToEnd() {
    // Chat list uses reverse: true, so offset 0 is the newest message.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_chatScroll.hasClients) return;
      _chatScroll.animateTo(
        0,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _loadInbox() async {
    final items = await widget.model.agentWorkspace.listInbox();
    if (mounted) setState(() => _inbox = items);
  }

  Future<void> _refreshMailbox({bool quiet = false}) async {
    if (_fetching) return;
    setState(() {
      _fetching = true;
      if (!quiet) _status = null;
    });
    try {
      await widget.model.fetchAgentMailbox();
      await _loadInbox();
      if (!quiet && mounted) {
        setState(() => _status = 'Inbox updated.');
      }
    } catch (e) {
      if (mounted) setState(() => _status = e.toString());
    } finally {
      if (mounted) setState(() => _fetching = false);
    }
  }

  Future<void> _pickPdf() async {
    final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf'],
      withData: true,
    );
    if (picked == null || picked.files.isEmpty) return;
    final f = picked.files.first;
    final bytes = f.bytes;
    if (bytes == null || bytes.isEmpty) {
      setState(() => _status = 'Could not read ${f.name}.');
      return;
    }
    await _ingestBytes(fileName: f.name, bytes: bytes);
  }

  Future<void> _ingestBytes({
    required String fileName,
    required List<int> bytes,
  }) async {
    final workspace = widget.model.agentWorkspace;
    final index = workspace.vaultIndex;
    final types = index?.types ?? [];
    final matched = index?.match(filename: fileName);
    var typeId = matched?.id ?? '';
    var password = typeId.isNotEmpty
        ? await workspace.vault.readFileTypePassword(typeId)
        : null;

    final encrypted = pdfLooksEncrypted(bytes);
    if (encrypted) {
      var opened =
          password != null &&
          password.isNotEmpty &&
          pdfOpensWithPassword(bytes, password: password);
      if (!opened) {
        if (!mounted) return;
        final choice = await showVaultPasswordSheet(
          context: context,
          types: types,
          fileName: fileName,
          suggestedTypeId: typeId.isNotEmpty ? typeId : null,
          unlockFailed: password != null && password.isNotEmpty,
        );
        if (choice == null) return;
        typeId = choice.typeId;
        password = (choice.password ?? '').trim().isEmpty
            ? null
            : choice.password!.trim();
        if (password != null &&
            !pdfOpensWithPassword(bytes, password: password)) {
          if (!mounted) return;
          setState(
            () => _status =
                'That password did not unlock $fileName. File was still saved.',
          );
        }
        if (choice.savePassword && password != null) {
          await workspace.vault.writeFileTypePassword(typeId, password);
        }
      }
    } else if (typeId.isEmpty && types.isNotEmpty) {
      if (!mounted) return;
      final choice = await showVaultPasswordSheet(
        context: context,
        types: types,
        fileName: fileName,
      );
      if (choice != null) {
        typeId = choice.typeId;
        final p = (choice.password ?? '').trim();
        if (choice.savePassword && p.isNotEmpty) {
          await workspace.vault.writeFileTypePassword(typeId, p);
        }
      }
    }

    await workspace.addLocalFile(
      fileName: fileName,
      bytes: bytes,
      fileTypeId: typeId,
    );
    await _loadInbox();
    if (mounted) setState(() => _status ??= 'Saved $fileName on this device.');
  }

  Future<void> _openClaim() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => MailboxClaimPage(model: widget.model)),
    );
    await _loadInbox();
  }

  Future<void> _revoke() async {
    await widget.model.revokeAgentMailbox();
    if (mounted) {
      setState(
        () => _status =
            'Mailbox disconnected. PDFs already on this phone stay here.',
      );
    }
  }

  Future<void> _rotate() async {
    await widget.model.rotateAgentMailbox();
    if (mounted) setState(() => _status = 'Mailbox credential rotated.');
  }

  Future<void> _sendMessage() async {
    final prompt = _composer.text.trim();
    if (prompt.isEmpty || _sending) return;

    final command = AgentCommands.exact(prompt);
    if (command != null) {
      await _runCommand(command);
      return;
    }

    final provider = AgentChatService.resolveProvider(widget.model);
    if (provider == null) {
      setState(() => _status = AgentChatService.unavailableHint(widget.model));
      return;
    }
    if (!await LlmConsentGate.ensure(context, widget.model, provider)) {
      if (mounted) {
        setState(() => _status = 'AI permission is required for chat.');
      }
      return;
    }

    setState(() {
      _composer.clear();
      _sending = true;
      _status = null;
      _commandMatches = const [];
      _messages.add(
        _ChatMessage(
          fromAgent: false,
          text: prompt,
          status: AgentTurnStatus.done,
          startedAt: DateTime.now(),
        ),
      );
      _messages.add(
        _ChatMessage(
          fromAgent: true,
          status: AgentTurnStatus.thinking,
          startedAt: DateTime.now(),
        ),
      );
    });
    final pendingIndex = _messages.length - 1;
    _stallTimer?.cancel();
    _stallTimer = Timer(_stallTimeout, () {
      if (!mounted ||
          !_sending ||
          pendingIndex >= _messages.length ||
          _messages[pendingIndex].status != AgentTurnStatus.thinking) {
        return;
      }
      setState(() {
        _messages[pendingIndex] = _messages[pendingIndex].copyWith(
          status: AgentTurnStatus.stalled,
        );
      });
      _scrollChatToEnd();
    });
    _scrollChatToEnd();

    try {
      final history = [
        for (var i = 0; i < pendingIndex - 1; i++)
          (fromAgent: _messages[i].fromAgent, text: _messages[i].text),
      ];
      final reply = await AgentChatService.reply(
        model: widget.model,
        prompt: prompt,
        history: history,
      );
      _stallTimer?.cancel();
      if (!mounted) return;
      setState(() {
        _sending = false;
        _messages[pendingIndex] = _ChatMessage(
          fromAgent: true,
          text: reply,
          status: AgentTurnStatus.done,
          startedAt: _messages[pendingIndex].startedAt,
        );
      });
      _scrollChatToEnd();
      unawaited(_persistHistory());
    } on LlmException catch (e) {
      _stallTimer?.cancel();
      if (!mounted) return;
      setState(() {
        _sending = false;
        _messages[pendingIndex] = _ChatMessage(
          fromAgent: true,
          text: e.message,
          status: AgentTurnStatus.failed,
          startedAt: _messages[pendingIndex].startedAt,
        );
      });
      _scrollChatToEnd();
      unawaited(_persistHistory());
    } catch (e) {
      _stallTimer?.cancel();
      if (!mounted) return;
      setState(() {
        _sending = false;
        _messages[pendingIndex] = _ChatMessage(
          fromAgent: true,
          text: 'Something went wrong. Try again in a moment.',
          status: AgentTurnStatus.failed,
          startedAt: _messages[pendingIndex].startedAt,
        );
        _status = e.toString();
      });
      _scrollChatToEnd();
      unawaited(_persistHistory());
    }
  }

  void _openPlan() {
    Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => RetirementPlanEditorPage(model: widget.model),
      ),
    );
  }

  void _showInbox() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * 0.7,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Agent inbox',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 20,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Fetch mail',
                      onPressed: _fetching
                          ? null
                          : () {
                              Navigator.pop(context);
                              unawaited(_refreshMailbox());
                            },
                      icon: const Icon(Icons.sync),
                    ),
                    IconButton(
                      tooltip: 'Add PDF',
                      onPressed: () {
                        Navigator.pop(context);
                        unawaited(_pickPdf());
                      },
                      icon: const Icon(Icons.note_add_outlined),
                    ),
                  ],
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.description_outlined,
                    color: widget.model.accent,
                  ),
                  title: const Text(
                    'Retirement plan',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: const Text('Open the plan your agent reads'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.pop(context);
                    _openPlan();
                  },
                ),
                const Divider(height: 8),
                if (_inbox.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Text('No PDFs on this phone yet.'),
                  )
                else
                  Flexible(
                    child: ListView(
                      shrinkWrap: true,
                      children: [
                        for (final item in _inbox)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(
                              item.confirmed
                                  ? Icons.mark_email_read_outlined
                                  : Icons.picture_as_pdf_outlined,
                              color: widget.model.accent,
                            ),
                            title: Text(
                              item.fileName,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            subtitle: Text(
                              [
                                if (item.from.isNotEmpty) item.from,
                                item.receivedAt
                                    .toLocal()
                                    .toString()
                                    .split('.')
                                    .first,
                              ].join(' · '),
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showMailbox() {
    final identity = widget.model.agentWorkspace.identity;
    final address = identity.mailboxAddress?.trim() ?? '';
    if (address.isEmpty) {
      unawaited(_openClaim());
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Private mailbox',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20),
              ),
              const SizedBox(height: 10),
              SelectableText(
                address,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              if ((identity.claimedEmail ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 6),
                Text('Accepts PDFs from ${identity.claimedEmail}'),
              ],
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: address));
                  if (context.mounted) Navigator.pop(context);
                },
                icon: const Icon(Icons.copy, size: 18),
                label: const Text('Copy address'),
              ),
              TextButton.icon(
                onPressed: _fetching
                    ? null
                    : () {
                        Navigator.pop(context);
                        unawaited(_refreshMailbox());
                      },
                icon: const Icon(Icons.sync, size: 18),
                label: Text(
                  _fetching ? 'Checking for PDFs…' : 'Check for new PDFs',
                ),
              ),
              TextButton(
                onPressed: () async {
                  Navigator.pop(context);
                  await _rotate();
                },
                child: const Text('Rotate key'),
              ),
              TextButton(
                onPressed: () async {
                  Navigator.pop(context);
                  await _revoke();
                },
                child: const Text('Disconnect'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([widget.model, widget.model.agentWorkspace]),
      builder: (context, _) => _AgentBody(
        model: widget.model,
        fetching: _fetching,
        sending: _sending,
        historyLoaded: _historyLoaded,
        welcome: _welcome,
        status: _status,
        inbox: _inbox,
        messages: _messages,
        commandMatches: _commandMatches,
        composer: _composer,
        composerFocus: _composerFocus,
        chatScroll: _chatScroll,
        onDismissKeyboard: _dismissKeyboard,
        onSend: _sendMessage,
        onRunCommand: (c) => unawaited(_runCommand(c)),
        onShowCommandMenu: _showCommandMenu,
        onOpenHelper: openHelperHub,
        onOpenInbox: _showInbox,
        onOpenMailbox: _showMailbox,
      ),
    );
  }
}

enum AgentTurnStatus { idle, thinking, stalled, done, failed }

class _ChatMessage {
  const _ChatMessage({
    required this.fromAgent,
    this.text = '',
    this.status = AgentTurnStatus.idle,
    this.startedAt,
  });

  final bool fromAgent;
  final String text;
  final AgentTurnStatus status;
  final DateTime? startedAt;

  _ChatMessage copyWith({AgentTurnStatus? status}) => _ChatMessage(
    fromAgent: fromAgent,
    text: text,
    status: status ?? this.status,
    startedAt: startedAt,
  );
}

class _AgentBody extends StatelessWidget {
  const _AgentBody({
    required this.model,
    required this.fetching,
    required this.sending,
    required this.historyLoaded,
    required this.welcome,
    required this.status,
    required this.inbox,
    required this.messages,
    required this.commandMatches,
    required this.composer,
    required this.composerFocus,
    required this.chatScroll,
    required this.onDismissKeyboard,
    required this.onSend,
    required this.onRunCommand,
    required this.onShowCommandMenu,
    required this.onOpenHelper,
    required this.onOpenInbox,
    required this.onOpenMailbox,
  });

  final AppModel model;
  final bool fetching;
  final bool sending;
  final bool historyLoaded;
  final String welcome;
  final String? status;
  final List<InboxItem> inbox;
  final List<_ChatMessage> messages;
  final List<AgentCommand> commandMatches;
  final TextEditingController composer;
  final FocusNode composerFocus;
  final ScrollController chatScroll;
  final VoidCallback onDismissKeyboard;
  final VoidCallback onSend;
  final ValueChanged<AgentCommand> onRunCommand;
  final VoidCallback onShowCommandMenu;
  final VoidCallback onOpenHelper;
  final VoidCallback onOpenInbox;
  final VoidCallback onOpenMailbox;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final workspace = model.agentWorkspace;
    final address = workspace.identity.mailboxAddress;
    final ready = AgentChatService.isReady(model);
    final statusLabel = AgentChatService.statusLabel(model);
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    final mailboxClaimed = address != null && address.isNotEmpty;
    final chatBg = isDark ? const Color(0xFF0E1621) : const Color(0xFFE7EDF4);

    return ColoredBox(
      color: chatBg,
      child: Column(
        children: [
          Material(
            color: cs.surface.withValues(alpha: isDark ? 0.92 : 0.96),
            elevation: 0.4,
            shadowColor: Colors.black26,
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, keyboardOpen ? 2 : 6, 8, 8),
              child: Column(
                children: [
                  Row(
                    children: [
                      Text(
                        'Agent',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: ready
                              ? model.accent.withValues(alpha: 0.12)
                              : cs.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          statusLabel,
                          style: TextStyle(
                            color: ready ? model.accent : cs.onSurfaceVariant,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const Spacer(),
                      TabHeaderActions(
                        model: model,
                        guideEnabled: model.guideEnabledGoals,
                        help: TabHelpContent.agent,
                        assistantTooltip: 'Plan helper',
                        assistantEnabled: model.helperEnabledGoals,
                        onAssistant: onOpenHelper,
                      ),
                    ],
                  ),
                  if (!keyboardOpen) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: _AgentAction(
                            icon: mailboxClaimed
                                ? (fetching
                                      ? Icons.hourglass_top
                                      : Icons.mark_email_read_outlined)
                                : Icons.alternate_email,
                            label: !mailboxClaimed
                                ? 'Claim email'
                                : fetching
                                ? 'Checking mail…'
                                : 'Mailbox',
                            onPressed: onOpenMailbox,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _AgentAction(
                            icon: inbox.isEmpty
                                ? Icons.inbox_outlined
                                : Icons.inbox_rounded,
                            label: inbox.isEmpty
                                ? 'Inbox'
                                : 'Inbox · ${inbox.length}',
                            onPressed: onOpenInbox,
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (status != null) ...[
                    const SizedBox(height: 6),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        status!,
                        style: TextStyle(
                          color: cs.onSurfaceVariant,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onDismissKeyboard,
              child: messages.isEmpty
                  ? _EmptyChat(text: historyLoaded ? welcome : '')
                  : Scrollbar(
                      controller: chatScroll,
                      child: ListView.builder(
                        controller: chatScroll,
                        reverse: true,
                        padding: const EdgeInsets.fromLTRB(10, 8, 10, 6),
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        itemCount: messages.length,
                        itemBuilder: (context, index) {
                          final i = messages.length - 1 - index;
                          final message = messages[i];
                          final prev = i > 0 ? messages[i - 1] : null;
                          return _ChatBubble(
                            message: message,
                            accent: model.accent,
                            showDayDivider: _startsNewDay(prev, message),
                          );
                        },
                      ),
                    ),
            ),
          ),
          if (commandMatches.isNotEmpty)
            _CommandSuggestions(
              commands: commandMatches,
              accent: model.accent,
              onSelect: onRunCommand,
            ),
          Material(
            color: cs.surface.withValues(alpha: isDark ? 0.94 : 0.98),
            elevation: 6,
            shadowColor: Colors.black26,
            // No SafeArea here: MainScaffold already reserves the home
            // indicator plus the floating tab bar, so adding the bottom inset
            // again would push the composer up and shrink the thread.
            child: Padding(
              padding: EdgeInsets.fromLTRB(10, 6, 10, keyboardOpen ? 6 : 4),
              child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: IconButton(
                        tooltip: 'Commands',
                        onPressed: onShowCommandMenu,
                        icon: const Icon(Icons.auto_awesome_motion_outlined),
                        style: IconButton.styleFrom(
                          foregroundColor: cs.onSurfaceVariant,
                          minimumSize: const Size(40, 44),
                        ),
                      ),
                    ),
                    Expanded(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: isDark
                              ? cs.surfaceContainerHighest
                              : cs.surfaceContainerLowest,
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(
                            color: cs.outlineVariant.withValues(alpha: 0.55),
                          ),
                        ),
                        child: TextField(
                          controller: composer,
                          focusNode: composerFocus,
                          enabled: ready && !sending,
                          minLines: 1,
                          maxLines: 5,
                          textCapitalization: TextCapitalization.sentences,
                          textInputAction: TextInputAction.send,
                          style: const TextStyle(fontSize: 16, height: 1.35),
                          decoration: InputDecoration(
                            hintText: ready
                                ? 'Message'
                                : AgentChatService.unavailableHint(model),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            filled: false,
                            contentPadding: const EdgeInsets.fromLTRB(
                              16,
                              12,
                              8,
                              12,
                            ),
                            prefixIcon: Icon(
                              Icons.lock_outline,
                              size: 18,
                              color: cs.onSurfaceVariant,
                            ),
                            suffixIcon: keyboardOpen
                                ? IconButton(
                                    tooltip: 'Hide keyboard',
                                    onPressed: onDismissKeyboard,
                                    icon: const Icon(
                                      Icons.keyboard_hide,
                                      size: 20,
                                    ),
                                  )
                                : null,
                          ),
                          onSubmitted: (_) => onSend(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: IconButton.filled(
                        tooltip: ready ? 'Send' : 'No language model available',
                        onPressed: ready && !sending ? onSend : null,
                        style: IconButton.styleFrom(
                          backgroundColor: model.accent,
                          foregroundColor: cs.onPrimary,
                          disabledBackgroundColor: cs.surfaceContainerHighest,
                          minimumSize: const Size(44, 44),
                        ),
                        icon: const Icon(Icons.arrow_upward, size: 22),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _AgentAction extends StatelessWidget {
  const _AgentAction({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton.tonalIcon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

/// True when [message] is the first turn of a calendar day, so the thread can
/// show a Telegram-style date separator.
bool _startsNewDay(_ChatMessage? prev, _ChatMessage message) {
  final at = message.startedAt;
  if (at == null) return false;
  final before = prev?.startedAt;
  if (before == null) return prev == null;
  return before.year != at.year ||
      before.month != at.month ||
      before.day != at.day;
}

class _EmptyChat extends StatelessWidget {
  const _EmptyChat({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    if (text.isEmpty) return const SizedBox.expand();
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_outline, size: 28, color: cs.onSurfaceVariant),
            const SizedBox(height: 10),
            Text(
              text,
              textAlign: TextAlign.center,
              style: TextStyle(color: cs.onSurfaceVariant, height: 1.45),
            ),
          ],
        ),
      ),
    );
  }
}

class _CommandSuggestions extends StatelessWidget {
  const _CommandSuggestions({
    required this.commands,
    required this.accent,
    required this.onSelect,
  });

  final List<AgentCommand> commands;
  final Color accent;
  final ValueChanged<AgentCommand> onSelect;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      constraints: const BoxConstraints(maxHeight: 224),
      margin: const EdgeInsets.fromLTRB(10, 0, 10, 6),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ListView.builder(
        shrinkWrap: true,
        padding: const EdgeInsets.symmetric(vertical: 4),
        itemCount: commands.length,
        itemBuilder: (context, i) {
          final c = commands[i];
          return ListTile(
            dense: true,
            visualDensity: VisualDensity.compact,
            leading: Icon(c.icon, size: 20, color: accent),
            title: Text(
              c.slash,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            subtitle: Text(
              c.description,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            onTap: () => onSelect(c),
          );
        },
      ),
    );
  }
}

class _DayDivider extends StatelessWidget {
  const _DayDivider({required this.at});

  final DateTime at;

  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final now = DateTime.now();
    final sameDay =
        at.year == now.year && at.month == now.month && at.day == now.day;
    final label = sameDay
        ? 'Today'
        : '${at.day} ${_months[at.month - 1]} ${at.year}';
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 10),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: isDark ? 0.32 : 0.08),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
            color: isDark ? Colors.white70 : Colors.black54,
          ),
        ),
      ),
    );
  }
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({
    required this.message,
    required this.accent,
    this.showDayDivider = false,
  });

  final _ChatMessage message;
  final Color accent;
  final bool showDayDivider;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fromAgent = message.fromAgent;
    final stalled = message.status == AgentTurnStatus.stalled;
    final failed = message.status == AgentTurnStatus.failed;
    final inFlight =
        message.status == AgentTurnStatus.thinking ||
        message.status == AgentTurnStatus.stalled;
    final statusColor = stalled
        ? Colors.amber.shade800
        : failed
        ? cs.error
        : accent;
    final maxBubble = MediaQuery.sizeOf(context).width * 0.78;
    final radius = fromAgent
        ? const BorderRadius.only(
            topLeft: Radius.circular(18),
            topRight: Radius.circular(18),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(18),
          )
        : const BorderRadius.only(
            topLeft: Radius.circular(18),
            topRight: Radius.circular(18),
            bottomLeft: Radius.circular(18),
            bottomRight: Radius.circular(4),
          );
    final bg = failed
        ? cs.errorContainer.withValues(alpha: 0.7)
        : stalled
        ? Colors.amber.withValues(alpha: isDark ? 0.16 : 0.18)
        : fromAgent
        ? (isDark ? const Color(0xFF182533) : Colors.white)
        : accent;
    final fg = fromAgent
        ? cs.onSurface
        : (ThemeData.estimateBrightnessForColor(accent) == Brightness.dark
              ? Colors.white
              : const Color(0xFF102018));

    final at = message.startedAt;
    final bubble = Align(
      alignment: fromAgent ? Alignment.centerLeft : Alignment.centerRight,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxBubble),
        child: Container(
          margin: EdgeInsets.only(
            bottom: 6,
            left: fromAgent ? 2 : 36,
            right: fromAgent ? 36 : 2,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: radius,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.28 : 0.06),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
            border: inFlight || failed
                ? Border.all(color: statusColor.withValues(alpha: 0.28))
                : (fromAgent && !isDark
                      ? Border.all(color: Colors.black.withValues(alpha: 0.04))
                      : null),
          ),
          child: inFlight
              ? _AgentTurnIndicator(status: message.status, color: statusColor)
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (failed) ...[
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.error_outline,
                            size: 16,
                            color: statusColor,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Reply failed',
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                    ],
                    SelectableText(
                      message.text,
                      style: TextStyle(
                        color: failed ? cs.onErrorContainer : fg,
                        height: 1.35,
                        fontSize: 15.5,
                      ),
                    ),
                    if (at != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Align(
                          alignment: Alignment.centerRight,
                          child: Text(
                            _clock(at),
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              color: (failed ? cs.onErrorContainer : fg)
                                  .withValues(alpha: 0.55),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
        ),
      ),
    );

    if (!showDayDivider || at == null) return bubble;
    return Column(
      children: [
        _DayDivider(at: at),
        bubble,
      ],
    );
  }

  static String _clock(DateTime at) {
    final h = at.hour.toString().padLeft(2, '0');
    final m = at.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class _AgentTurnIndicator extends StatelessWidget {
  const _AgentTurnIndicator({required this.status, required this.color});

  final AgentTurnStatus status;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final stalled = status == AgentTurnStatus.stalled;
    return Semantics(
      liveRegion: true,
      label: stalled ? 'Taking longer than usual' : 'Thinking',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (stalled)
            Icon(Icons.schedule_rounded, size: 17, color: color)
          else
            _PulsingDots(color: color),
          const SizedBox(width: 9),
          Text(
            stalled ? 'Taking longer than usual…' : 'Thinking…',
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _PulsingDots extends StatefulWidget {
  const _PulsingDots({required this.color});

  final Color color;

  @override
  State<_PulsingDots> createState() => _PulsingDotsState();
}

class _PulsingDotsState extends State<_PulsingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < 3; i++)
            Padding(
              padding: EdgeInsets.only(right: i == 2 ? 0 : 3),
              child: Opacity(
                opacity:
                    0.25 +
                    (0.75 * (1 - ((_controller.value - (i * 0.2)).abs() % 1))),
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: widget.color,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
