import 'dart:math';

import '../../state/app_model.dart';
import '../agent_workspace.dart';
import '../cron_bridge.dart';
import '../document_store.dart';
import '../hermes_home_paths.dart';
import '../pdf_unlock.dart';

/// In-process MCP tool implementations Zoro hosts for Hermes.
class ZoroMcpTools {
  ZoroMcpTools({required this.workspace, this.model});

  final AgentWorkspace workspace;
  final AppModel? model;

  static const toolNames = <String>[
    'read_ledger_summary',
    'list_inbox',
    'get_inbox_item',
    'unlock_attachment',
    'commit_doc',
    'read_doc',
    'list_revs',
    'diff_rev',
    'compute_corpus',
    'update_context_sidecar',
    'notifications.upsert_cron',
    'notifications.cancel_cron',
    'notifications.list_cron',
  ];

  Future<Object?> call(String name, Map<String, dynamic> args) async {
    switch (name) {
      case 'read_ledger_summary':
        return _ledgerSummary();
      case 'list_inbox':
        return {
          'items': [
            for (final i in await workspace.listInbox())
              {
                'id': i.id,
                'fileName': i.fileName,
                'from': i.from,
                'subject': i.subject,
                'fileTypeId': i.fileTypeId,
                'confirmed': i.confirmed,
                'receivedAt': i.receivedAt.toUtc().toIso8601String(),
              },
          ],
        };
      case 'get_inbox_item':
        final id = args['id']?.toString() ?? '';
        for (final i in await workspace.listInbox()) {
          if (i.id == id) {
            return {
              'id': i.id,
              'fileName': i.fileName,
              'from': i.from,
              'subject': i.subject,
              'fileTypeId': i.fileTypeId,
              'localRelPath': i.localRelPath,
            };
          }
        }
        return {'error': 'not_found'};
      case 'unlock_attachment':
        return _unlock(args);
      case 'commit_doc':
        return _commitDoc(args);
      case 'read_doc':
        final id = args['id']?.toString() ?? HermesHomePaths.retirementDocId;
        return {
          'id': id,
          'markdown': await workspace.documents?.readHead(id) ?? '',
        };
      case 'list_revs':
        final id = args['id']?.toString() ?? HermesHomePaths.retirementDocId;
        final revs = await workspace.documents?.listRevs(id) ?? [];
        return {
          'id': id,
          'revs': [
            for (final r in revs)
              {
                'rev': r.rev,
                'utc': r.utc.toIso8601String(),
                'author': r.author,
                'reason': r.reason,
              },
          ],
        };
      case 'diff_rev':
        return _diffRev(args);
      case 'compute_corpus':
        return _computeCorpus();
      case 'update_context_sidecar':
        return _updateSidecar(args);
      case 'notifications.upsert_cron':
        return _upsertCron(args);
      case 'notifications.cancel_cron':
        return _cancelCron(args);
      case 'notifications.list_cron':
        final jobs = await workspace.cron?.listJobs() ?? [];
        return {
          'jobs': [
            for (final j in jobs)
              {
                'id': j.id,
                'title': j.title,
                'schedule': j.schedule,
                'skillId': j.skillId,
                'prompt': j.prompt,
                if (j.nextAt != null)
                  'nextAt': j.nextAt!.toUtc().toIso8601String(),
              },
          ],
        };
      default:
        return {'error': 'unknown_tool', 'name': name};
    }
  }

  Map<String, dynamic> _ledgerSummary() {
    final m = model;
    if (m == null) return {'available': false};
    return {
      'available': true,
      'assets': m.assets.length,
      'liabilities': m.liabilities.length,
      'incomeLines': m.incomeLines.length,
      'investMonthly': m.allocInvestmentsMonthly,
      'planChars': m.retirementMarkdownCache.length,
    };
  }

  Future<Map<String, dynamic>> _unlock(Map<String, dynamic> args) async {
    final id = args['id']?.toString() ?? '';
    final items = await workspace.listInbox();
    final item = items.where((i) => i.id == id).firstOrNull;
    if (item == null) return {'ok': false, 'error': 'not_found'};
    final file = workspace.inbox?.fileFor(item);
    final bytes = file == null || !await file.exists()
        ? null
        : await file.readAsBytes();
    if (bytes == null) return {'ok': false, 'error': 'missing_file'};
    if (!pdfLooksEncrypted(bytes)) {
      return {'ok': true, 'encrypted': false, 'fileName': item.fileName};
    }
    final typeId = item.fileTypeId.isNotEmpty
        ? item.fileTypeId
        : (workspace.vaultIndex
                  ?.match(filename: item.fileName, from: item.from)
                  ?.id ??
              '');
    if (typeId.isEmpty) {
      return {'ok': false, 'needsType': true, 'fileName': item.fileName};
    }
    final password = await workspace.vault.readFileTypePassword(typeId);
    if (password == null || password.isEmpty) {
      return {'ok': false, 'needsPassword': true, 'fileTypeId': typeId};
    }
    final opened = pdfOpensWithPassword(bytes, password: password);
    if (opened) await workspace.vaultIndex?.touch(typeId);
    return {
      'ok': opened,
      'encrypted': true,
      'fileTypeId': typeId,
      if (!opened) 'needsPassword': true,
    };
  }

  Future<Map<String, dynamic>> _commitDoc(Map<String, dynamic> args) async {
    if (args['confirmed'] != true) {
      return {
        'ok': false,
        'needsConfirm': true,
        'message':
            'Human confirm is required before committing a living document.',
      };
    }
    final id = args['id']?.toString() ?? HermesHomePaths.retirementDocId;
    final markdown = args['markdown']?.toString() ?? '';
    final reason = args['reason']?.toString() ?? 'mcp commit_doc';
    final docs = workspace.documents;
    if (docs == null) return {'ok': false, 'error': 'not_ready'};
    final entry = await docs.commit(
      id: id,
      markdown: markdown,
      reason: reason,
      author: 'agent',
    );
    if (id == HermesHomePaths.retirementDocId) {
      model?.retirementMarkdownCache = markdown;
    }
    return {'ok': true, 'id': entry.id, 'headRev': entry.headRev};
  }

  Future<Map<String, dynamic>> _diffRev(Map<String, dynamic> args) async {
    final id = args['id']?.toString() ?? HermesHomePaths.retirementDocId;
    final rev = (args['rev'] as num?)?.toInt();
    final docs = workspace.documents;
    if (docs == null || rev == null) return {'error': 'bad_args'};
    final head = await docs.readHead(id) ?? '';
    final old = await docs.readRev(id, rev) ?? '';
    return {
      'id': id,
      'rev': rev,
      'diff': DocumentStore.unifiedDiff(old, head, path: '$id.md'),
    };
  }

  Map<String, dynamic> _computeCorpus() {
    final m = model;
    if (m == null) return {'available': false};
    return {
      'available': true,
      'investMonthly': m.allocInvestmentsMonthly,
      'savingsMonthly': m.allocSavingsMonthly,
      'planChars': m.retirementMarkdownCache.length,
    };
  }

  Future<Map<String, dynamic>> _updateSidecar(Map<String, dynamic> args) async {
    if (args['confirmed'] != true) {
      return {'ok': false, 'needsConfirm': true};
    }
    final m = model;
    if (m == null) return {'ok': false, 'error': 'no_model'};
    final key = args['storageKey']?.toString() ?? '';
    final markdown = args['markdown']?.toString() ?? '';
    if (key.startsWith('asset:')) {
      m.setAssetContextMarkdown(assetId: key.substring(6), markdown: markdown);
    } else if (key.startsWith('liability:')) {
      m.setLiabilityContextMarkdown(
        liabilityId: key.substring(10),
        markdown: markdown,
      );
    } else if (key.startsWith('bucket:')) {
      m.setExpenseBucketContextMarkdown(
        bucketKey: key.substring(7),
        markdown: markdown,
      );
    } else if (key.startsWith('month:')) {
      m.setMonthlyCashflowContextMarkdown(
        monthKey: key.substring(6),
        markdown: markdown,
      );
    } else {
      return {'ok': false, 'error': 'bad_key'};
    }
    return {'ok': true, 'storageKey': key};
  }

  Future<Map<String, dynamic>> _upsertCron(Map<String, dynamic> args) async {
    final cron = workspace.cron;
    if (cron == null) return {'ok': false, 'error': 'not_ready'};
    final id = (args['id']?.toString() ?? '').trim();
    if (id.isEmpty) return {'ok': false, 'error': 'missing_id'};
    DateTime? nextAt;
    final rawNext = args['nextAt']?.toString();
    if (rawNext != null) nextAt = DateTime.tryParse(rawNext);
    final job = CronJobDef(
      id: id,
      title: args['title']?.toString() ?? id,
      schedule: args['schedule']?.toString() ?? '',
      skillId: args['skillId']?.toString() ?? '',
      prompt: args['prompt']?.toString() ?? '',
      nextAt: nextAt,
    );
    await cron.upsert(job);
    final m = model;
    if (m != null) {
      await cron.sync(
        notificationsEnabled: m.notificationsEnabled,
        agentJobsEnabled: m.agentJobsEnabled,
      );
    }
    return {'ok': true, 'id': id};
  }

  Future<Map<String, dynamic>> _cancelCron(Map<String, dynamic> args) async {
    final cron = workspace.cron;
    if (cron == null) return {'ok': false, 'error': 'not_ready'};
    final id = args['id']?.toString() ?? '';
    await cron.remove(id);
    return {'ok': true, 'id': id};
  }
}

/// Rotates a loopback bearer for the MCP host. Never written into yaml.
abstract final class McpLoopbackToken {
  static String mint() {
    final r = Random.secure();
    final bytes = List<int>.generate(24, (_) => r.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }
}
