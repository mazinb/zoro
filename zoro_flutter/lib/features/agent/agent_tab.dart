import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/agent/hermes_adapter.dart';
import '../../core/agent/inbox_store.dart';
import '../../core/agent/pdf_unlock.dart';
import '../../core/state/app_model.dart';
import '../../shared/help/tab_help_content.dart';
import '../../shared/widgets/context_markdown_view.dart';
import '../../shared/widgets/liquid_glass.dart';
import '../../shared/widgets/tab_header_actions.dart';
import '../goals/goal_editor_sheet.dart';
import '../goals/goals_ai_flow.dart';
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
  bool _fetching = false;
  String? _status;
  List<InboxItem> _inbox = [];

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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_loadInbox());
      if (widget.model.agentWorkspace.hasMailbox) {
        unawaited(_refreshMailbox(quiet: true));
      }
    });
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

  Future<void> _ingestBytes({required String fileName, required List<int> bytes}) async {
    final workspace = widget.model.agentWorkspace;
    final index = workspace.vaultIndex;
    final types = index?.types ?? [];
    final matched = index?.match(filename: fileName);
    var typeId = matched?.id ?? '';
    var password = typeId.isNotEmpty ? await workspace.vault.readFileTypePassword(typeId) : null;

    final encrypted = pdfLooksEncrypted(bytes);
    if (encrypted) {
      var opened = password != null && password.isNotEmpty && pdfOpensWithPassword(bytes, password: password);
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
        password = (choice.password ?? '').trim().isEmpty ? null : choice.password!.trim();
        if (password != null && !pdfOpensWithPassword(bytes, password: password)) {
          if (!mounted) return;
          setState(() => _status = 'That password did not unlock $fileName. File was still saved.');
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

    await workspace.addLocalFile(fileName: fileName, bytes: bytes, fileTypeId: typeId);
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
    if (mounted) setState(() => _status = 'Mailbox disconnected. PDFs already on this phone stay here.');
  }

  Future<void> _rotate() async {
    await widget.model.rotateAgentMailbox();
    if (mounted) setState(() => _status = 'Mailbox credential rotated.');
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([widget.model, widget.model.agentWorkspace]),
      builder: (context, _) => _AgentBody(
        model: widget.model,
        fetching: _fetching,
        status: _status,
        inbox: _inbox,
        onRefreshMailbox: () => _refreshMailbox(),
        onPickPdf: _pickPdf,
        onOpenHelper: openHelperHub,
        onOpenPlan: () {
          Navigator.of(context).push<void>(
            MaterialPageRoute(builder: (_) => RetirementPlanEditorPage(model: widget.model)),
          );
        },
        onClaimMailbox: _openClaim,
        onRevokeMailbox: _revoke,
        onRotateMailbox: _rotate,
      ),
    );
  }
}

class _AgentBody extends StatelessWidget {
  const _AgentBody({
    required this.model,
    required this.fetching,
    required this.status,
    required this.inbox,
    required this.onRefreshMailbox,
    required this.onPickPdf,
    required this.onOpenHelper,
    required this.onOpenPlan,
    required this.onClaimMailbox,
    required this.onRevokeMailbox,
    required this.onRotateMailbox,
  });

  final AppModel model;
  final bool fetching;
  final String? status;
  final List<InboxItem> inbox;
  final VoidCallback onRefreshMailbox;
  final VoidCallback onPickPdf;
  final VoidCallback onOpenHelper;
  final VoidCallback onOpenPlan;
  final VoidCallback onClaimMailbox;
  final VoidCallback onRevokeMailbox;
  final VoidCallback onRotateMailbox;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final workspace = model.agentWorkspace;
    final address = workspace.identity.mailboxAddress;
    final hermes = workspace.hermesStatus;
    final hermesLabel = switch (hermes.presence) {
      HermesPresence.missing => 'Not installed',
      HermesPresence.ready => 'Ready${hermes.packageVersion != null ? ' · ${hermes.packageVersion}' : ''}',
      HermesPresence.incompatible => 'Needs update',
    };
    final targets = model.financialGoals.where((g) => !g.isRetirement).toList();
    final md = model.retirementMarkdownCache;
    final preview = md.trim().isEmpty ? 'No living plan yet.' : md;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        Row(
          children: [
            Text('Agent', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
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
        const SizedBox(height: 12),
        LiquidGlassPanel(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('On-device agent', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
              const SizedBox(height: 6),
              Text('Hermes: $hermesLabel', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13)),
              const SizedBox(height: 4),
              Text(
                address == null || address.isEmpty
                    ? 'No mailbox yet. Claim a private forwarding address so Hermes can receive PDFs.'
                    : 'Mailbox: $address',
                style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
              ),
              if (workspace.identity.claimedEmail != null && workspace.identity.claimedEmail!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Claimed as ${workspace.identity.claimedEmail}',
                    style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
                  ),
                ),
              const SizedBox(height: 8),
              if (address == null || address.isEmpty)
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton.icon(
                    onPressed: onClaimMailbox,
                    icon: const Icon(Icons.mail_outline, size: 18),
                    label: const Text('Claim private mailbox'),
                  ),
                )
              else
                Wrap(
                  spacing: 8,
                  children: [
                    TextButton.icon(
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: address));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Address copied.')),
                          );
                        }
                      },
                      icon: const Icon(Icons.copy, size: 16),
                      label: const Text('Copy address'),
                    ),
                    TextButton(onPressed: onRotateMailbox, child: const Text('Rotate key')),
                    TextButton(onPressed: onRevokeMailbox, child: const Text('Disconnect')),
                  ],
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        LiquidGlassPanel(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('Inbox', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
                  ),
                  IconButton(
                    tooltip: 'Fetch mail',
                    onPressed: fetching ? null : onRefreshMailbox,
                    icon: fetching
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.sync),
                  ),
                  IconButton(
                    tooltip: 'Add PDF',
                    onPressed: onPickPdf,
                    icon: const Icon(Icons.note_add_outlined),
                  ),
                ],
              ),
              if (status != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(status!, style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
                ),
              if (inbox.isEmpty)
                Text(
                  address == null || address.isEmpty
                      ? 'Drop a PDF here, or claim a mailbox and forward statements from your verified email.'
                      : 'Forward PDFs from your claimed email. Pickup deletes the copy from getzoro.com after it lands on this phone.',
                  style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
                )
              else
                for (final item in inbox.take(12))
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    leading: Icon(
                      item.confirmed ? Icons.mark_email_read_outlined : Icons.attach_file,
                      color: model.accent,
                    ),
                    title: Text(item.fileName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    subtitle: Text(
                      [
                        if (item.from.isNotEmpty) item.from,
                        item.receivedAt.toLocal().toString().split('.').first,
                      ].join(' · '),
                      style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
                    ),
                  ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        LiquidGlassPanel(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('Retirement plan', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
                  ),
                  TextButton(onPressed: onOpenPlan, child: const Text('Edit')),
                ],
              ),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 220),
                child: ClipRect(
                  child: IgnorePointer(
                    child: SingleChildScrollView(
                      child: ContextMarkdownView(markdown: preview),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (targets.isNotEmpty) ...[
          const SizedBox(height: 12),
          LiquidGlassPanel(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Other targets', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
                const SizedBox(height: 6),
                for (final g in targets)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(g.name, style: const TextStyle(fontWeight: FontWeight.w800)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => openGoalEditorSheet(context: context, model: model, goalId: g.id),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        LiquidGlassPanel(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Skills & jobs', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
              const SizedBox(height: 6),
              Text(
                'No finance skills installed yet. Hermes cron jobs will appear here.',
                style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
