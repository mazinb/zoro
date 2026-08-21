import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../state/financial_goals.dart';
import 'chat_history_store.dart';
import 'credential_vault.dart';
import 'cron_bridge.dart';
import 'document_store.dart';
import 'hermes_adapter.dart';
import 'hermes_home_paths.dart';
import 'hermes_home_writer.dart';
import 'identity_store.dart';
import 'inbox_store.dart';
import 'mailbox_client.dart';
import 'retirement_migration.dart';
import 'retirement_plan_codec.dart';
import 'skill_pack.dart';
import 'skill_registry.dart';
import 'vault_index.dart';

/// On-device agent house: docs, inbox, vault index, Hermes stub.
class AgentWorkspace extends ChangeNotifier {
  AgentWorkspace({
    Directory? home,
    CredentialVault? vault,
    HermesAdapter? hermes,
    MailboxClient? mailbox,
  }) : _injectedHome = home,
       vault = vault ?? CredentialVault(),
       hermes = hermes ?? StubHermesAdapter(),
       mailbox = mailbox ?? MailboxClient();

  final Directory? _injectedHome;
  final CredentialVault vault;
  final HermesAdapter hermes;
  final MailboxClient mailbox;

  Directory? _home;
  DocumentStore? documents;
  InboxStore? inbox;
  IdentityStore? identityStore;
  VaultIndex? vaultIndex;
  SkillRegistry? skills;
  CronBridge? cron;
  ChatHistoryStore? chatHistory;
  AgentIdentity identity = AgentIdentity();
  HermesStatus hermesStatus = const HermesStatus(
    presence: HermesPresence.missing,
  );
  bool ready = false;
  String? lastError;

  Directory get home {
    final h = _home;
    if (h == null) {
      throw StateError('AgentWorkspace.prepare has not run');
    }
    return h;
  }

  Future<Directory> _supportDir() async {
    if (_injectedHome != null) return _injectedHome;
    return getApplicationSupportDirectory();
  }

  Future<void> prepare({
    FinancialGoal? retirementGoal,
    double investMonthly = 0,
    void Function(RetirementPlanDoc doc)? onRetirementLoaded,
    Future<String> Function(String assetPath)? loadSkillAsset,
  }) async {
    lastError = null;
    try {
      _home = await _supportDir();
      await _home!.create(recursive: true);
      documents = DocumentStore(_home!);
      inbox = InboxStore(_home!);
      identityStore = IdentityStore(_home!);
      skills = SkillRegistry(_home!);
      cron = CronBridge(_home!);
      chatHistory = ChatHistoryStore(_home!);
      vaultIndex = VaultIndex(File(vaultIndexPath(_home!)));

      await documents!.ensureLayout();
      await inbox!.ensure();
      await chatHistory!.ensure();
      await skills!.ensureEmpty();
      await HermesHomeWriter.ensureIdentityFiles(_home!);
      if (loadSkillAsset != null) {
        try {
          await skills!.installBundled(loadAsset: loadSkillAsset);
        } catch (_) {
          await skills!.ensureEmpty();
        }
      }
      await Directory(
        '${_home!.path}/${HermesHomePaths.cronDir}',
      ).create(recursive: true);
      final noBundled = File(
        '${_home!.path}/${HermesHomePaths.noBundledSkillsFile}',
      );
      if (!await noBundled.exists()) {
        await noBundled.create(recursive: true);
      }
      await vaultIndex!.load();
      identity = await identityStore!.load();
      hermesStatus = await hermes.status();

      if (retirementGoal != null) {
        final existing = await documents!.readHead(
          HermesHomePaths.retirementDocId,
        );
        if (existing == null || existing.trim().isEmpty) {
          final md = seedRetirementMarkdown(
            goal: retirementGoal,
            investMonthly: investMonthly,
          );
          await documents!.commit(
            id: HermesHomePaths.retirementDocId,
            markdown: md,
            reason: 'migration from goals.json',
            author: 'migration',
            title: retirementGoal.name.trim().isEmpty
                ? 'Retirement'
                : retirementGoal.name.trim(),
            skill: 'retirement-plan',
          );
        }
      }

      final head = await documents!.readHead(HermesHomePaths.retirementDocId);
      if (head != null && head.trim().isNotEmpty) {
        onRetirementLoaded?.call(RetirementPlanDoc.parse(head));
      }
      ready = true;
    } catch (e) {
      lastError = e.toString();
      ready = false;
    }
    notifyListeners();
  }

  Future<String> retirementMarkdown() async {
    return (await documents?.readHead(HermesHomePaths.retirementDocId)) ?? '';
  }

  RetirementPlanDoc retirementDocFrom(String raw) =>
      RetirementPlanDoc.parse(raw);

  Future<DocIndexEntry> saveRetirement({
    required String markdown,
    required String reason,
    String author = 'user',
  }) async {
    final store = documents;
    if (store == null) {
      throw StateError('DocumentStore not ready');
    }
    final parsed = RetirementPlanDoc.parse(markdown);
    final existing = await store.entryFor(HermesHomePaths.retirementDocId);
    final nextRev = (existing?.headRev ?? 0) + 1;
    final next = RetirementPlanDoc(
      rev: nextRev,
      retireBy: parsed.retireBy,
      swrPct: parsed.swrPct,
      investMonthly: parsed.investMonthly,
      body: parsed.body,
    );
    final entry = await store.commit(
      id: HermesHomePaths.retirementDocId,
      markdown: next.encode(),
      reason: reason,
      author: author,
      title: 'Retirement',
      skill: 'retirement-plan',
    );
    notifyListeners();
    return entry;
  }

  Future<DateTime?> loadPlanUpdatedAt() async {
    final entries = await documents?.listDocs() ?? [];
    return documents?.lastCommitAt(entries);
  }

  Future<List<InboxItem>> listInbox() async => inbox?.list() ?? [];

  Future<InboxItem> addLocalFile({
    required String fileName,
    required List<int> bytes,
    String from = '',
    String fileTypeId = '',
  }) async {
    final item = await inbox!.addFile(
      fileName: fileName,
      bytes: bytes,
      from: from,
      fileTypeId: fileTypeId,
    );
    if (fileTypeId.isNotEmpty) {
      await vaultIndex?.touch(fileTypeId);
    }
    notifyListeners();
    return item;
  }

  Future<void> setAllowlist(List<String> allowlist) async {
    identity.allowlist = allowlist;
    await identityStore?.save(identity);
    notifyListeners();
  }

  bool get hasMailbox => (identity.mailboxAddress ?? '').trim().isNotEmpty;

  Future<void> applyClaim(MailboxClaimInfo info) async {
    await vault.writeMailboxToken(info.mailboxToken);
    identity.mailboxAddress = info.address;
    identity.claimedEmail = info.claimedEmail;
    final email = info.claimedEmail.trim().toLowerCase();
    if (email.isNotEmpty &&
        !identity.allowlist.any((a) => a.toLowerCase() == email)) {
      identity.allowlist = [email, ...identity.allowlist];
    }
    await identityStore?.save(identity);
    notifyListeners();
  }

  Future<void> requestClaim({
    required String deviceId,
    required String email,
    required String username,
  }) {
    return mailbox.requestClaim(
      deviceId: deviceId,
      email: email.trim().toLowerCase(),
      username: username.trim().toLowerCase(),
    );
  }

  Future<MailboxUsernameCheck> checkUsername({
    required String username,
    String? deviceId,
  }) {
    return mailbox.checkUsername(username: username, deviceId: deviceId);
  }

  Future<MailboxClaimInfo> finishClaim({
    required String deviceId,
    String? nonce,
  }) async {
    final info = await mailbox.finishClaim(deviceId: deviceId, nonce: nonce);
    await applyClaim(info);
    return info;
  }

  Future<void> rotateMailbox({required String deviceId}) async {
    final token = await vault.readMailboxToken();
    if (token == null || token.isEmpty) return;
    final next = await mailbox.register(
      deviceId: deviceId,
      mailboxToken: token,
    );
    if (next == null) return;
    await vault.writeMailboxToken(next.mailboxToken);
    identity.mailboxAddress = next.address;
    await identityStore?.save(identity);
    notifyListeners();
  }

  Future<void> revokeMailbox() async {
    final token = await vault.readMailboxToken();
    if (token != null && token.isNotEmpty) {
      try {
        await mailbox.revoke(mailboxToken: token);
      } catch (_) {}
    }
    await vault.writeMailboxToken(null);
    identity.mailboxAddress = null;
    identity.claimedEmail = null;
    await identityStore?.save(identity);
    notifyListeners();
  }

  Future<void> fetchMailbox({String? deviceId}) async {
    final token = await vault.readMailboxToken();
    if (token == null || token.isEmpty) return;
    final pending = await mailbox.pending(mailboxToken: token);
    final existing = await inbox?.list() ?? [];
    final seenRemote = {
      for (final i in existing)
        if (i.remoteId.trim().isNotEmpty) i.remoteId,
    };
    for (final p in pending) {
      if (seenRemote.contains(p.id)) {
        await mailbox.ack(mailboxToken: token, itemId: p.id);
        continue;
      }
      if (!_senderAllowed(p.from)) {
        await mailbox.ack(mailboxToken: token, itemId: p.id);
        continue;
      }
      final bytes = await mailbox.downloadBytes(p, mailboxToken: token);
      if (bytes == null || bytes.isEmpty) continue;
      final matched = vaultIndex?.match(filename: p.fileName, from: p.from);
      await inbox!.addFile(
        fileName: p.fileName,
        bytes: bytes,
        from: p.from,
        subject: p.subject,
        fileTypeId: matched?.id ?? '',
        remoteId: p.id,
      );
      seenRemote.add(p.id);
      await mailbox.ack(mailboxToken: token, itemId: p.id);
    }
    notifyListeners();
  }

  bool _senderAllowed(String from) {
    if (identity.allowlist.isEmpty) return true;
    final f = from.toLowerCase();
    return identity.allowlist.any((a) => f.contains(a.toLowerCase()));
  }

  bool hasSkill(String nameOrId) {
    final reg = skills;
    if (reg == null) return false;
    final needle = nameOrId.split('/').last;
    for (final id in SkillPack.bundledIds) {
      if (id == nameOrId || id.endsWith('/$needle')) {
        return reg.skillFile(id).existsSync();
      }
    }
    return false;
  }
}
