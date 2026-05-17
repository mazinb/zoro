import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/persistence/app_state_transfer.dart';
import '../../core/state/app_model.dart';

/// Settings → Agents → Data: export / import ledger as JSON.
class DataTransferPane extends StatefulWidget {
  const DataTransferPane({super.key, required this.model});

  final AppModel model;

  @override
  State<DataTransferPane> createState() => _DataTransferPaneState();
}

class _DataTransferPaneState extends State<DataTransferPane> {
  bool _busy = false;
  String? _status;

  Future<void> _exportToFile() async {
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      final text = AppStateTransfer.encodeLedgerExportJson(widget.model);
      final bytes = utf8.encode(text);
      final path = await FilePicker.saveFile(
        dialogTitle: 'Export Zoro ledger',
        fileName: AppStateTransfer.suggestedExportFileName(),
        type: FileType.custom,
        allowedExtensions: const ['json'],
        bytes: bytes,
      );
      if (!mounted) return;
      setState(() {
        _status = path == null ? 'Export cancelled.' : 'Saved to $path';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _status = 'Export failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copyExportToClipboard() async {
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      final text = AppStateTransfer.encodeLedgerExportJson(widget.model);
      await Clipboard.setData(ClipboardData(text: text));
      if (!mounted) return;
      setState(() => _status = 'Copied ${text.length} characters to clipboard.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _status = 'Copy failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _importFromFile() async {
    final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['json'],
      withData: true,
    );
    if (picked == null || picked.files.isEmpty) return;
    final file = picked.files.single;
    final bytes = file.bytes;
    if (bytes == null || bytes.isEmpty) {
      if (!mounted) return;
      setState(() => _status = 'Could not read file bytes.');
      return;
    }
    final text = utf8.decode(bytes);
    await _applyImportText(text, sourceLabel: file.name);
  }

  Future<void> _applyImportText(String text, {required String sourceLabel}) async {
    Map<String, dynamic> root;
    try {
      root = AppStateTransfer.parseImportJson(text);
    } catch (e) {
      if (!mounted) return;
      setState(() => _status = e is FormatException ? e.message : 'Invalid JSON: $e');
      return;
    }

    final ledgerOnly = AppStateTransfer.isLedgerOnlyExport(root);

    if (!mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(ledgerOnly ? 'Replace ledger?' : 'Replace app data?'),
        content: Text(
          ledgerOnly
              ? 'Import from $sourceLabel will replace assets, liabilities, income, '
                  'expenses, and cashflow on this device. Goals, chats, agents, and '
                  'reminders are not changed.\n\nExport a backup first if you are unsure.'
              : 'Import from $sourceLabel will replace your current ledger, goals, chats, '
                  'and settings on this device. API keys in secure storage are not changed.\n\n'
                  'Export a backup first if you are unsure.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Import')),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      await AppStateTransfer.applyImport(widget.model, root);
      if (!mounted) return;
      setState(() => _status = 'Import complete. Review Home and Ledger.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _status = 'Import failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Export / import',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        Text(
          'Ledger export: one portable JSON with assets, liabilities, cashflow, and '
          'inline context notes. On device, data is split into smaller files '
          '(ledger.json, goals.json, settings.json, agents/, etc.) linked from app_state.json.',
          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12, height: 1.35),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _busy ? null : _exportToFile,
          icon: const Icon(Icons.upload_file),
          label: const Text('Export ledger JSON…'),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _busy ? null : _copyExportToClipboard,
          icon: const Icon(Icons.copy),
          label: const Text('Copy ledger JSON'),
        ),
        const SizedBox(height: 8),
        FilledButton.tonalIcon(
          onPressed: _busy ? null : _importFromFile,
          icon: const Icon(Icons.download),
          label: const Text('Import JSON file…'),
        ),
        if (_busy) ...[
          const SizedBox(height: 16),
          const Center(child: CircularProgressIndicator()),
        ],
        if (_status != null) ...[
          const SizedBox(height: 12),
          Text(
            _status!,
            style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
          ),
        ],
      ],
    );
  }
}
