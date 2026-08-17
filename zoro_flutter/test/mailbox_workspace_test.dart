import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:zoro_flutter/core/agent/agent_workspace.dart';
import 'package:zoro_flutter/core/agent/credential_vault.dart';
import 'package:zoro_flutter/core/agent/mailbox_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  FlutterSecureStorage.setMockInitialValues({});

  test('parses mailbox claim deep links', () {
    expect(
      isMailboxClaimUri(Uri.parse('zoro://mailbox/claim?nonce=abc')),
      isTrue,
    );
    expect(
      isMailboxClaimUri(
        Uri.parse('https://www.getzoro.com/mailbox/claim?nonce=abc'),
      ),
      isTrue,
    );
    expect(
      isMailboxClaimUri(Uri.parse('https://www.getzoro.com/legal')),
      isFalse,
    );
    expect(
      mailboxNonceFromUri(Uri.parse('zoro://mailbox/claim?nonce=abc')),
      'abc',
    );
  });

  test(
    'seeds allowlist, skips duplicate remote ids, and clears credentials on revoke',
    () async {
      final dir = await Directory.systemTemp.createTemp('zoro-mailbox-');
      final mailbox = _FakeMailbox();
      final workspace = AgentWorkspace(
        home: dir,
        vault: CredentialVault(),
        mailbox: mailbox,
      );
      await workspace.prepare();

      await workspace.applyClaim(
        const MailboxClaimInfo(
          address: 'zoro-abc@getzoro.com',
          mailboxToken: 'zmb_token',
          claimedEmail: 'ada@example.com',
        ),
      );
      expect(workspace.identity.mailboxAddress, 'zoro-abc@getzoro.com');
      expect(workspace.identity.allowlist, contains('ada@example.com'));

      mailbox.pendingItems = [
        const MailboxPendingItem(
          id: 'm1',
          fileName: 'a.pdf',
          from: 'ada@example.com',
        ),
        const MailboxPendingItem(
          id: 'm1',
          fileName: 'a.pdf',
          from: 'ada@example.com',
        ),
      ];
      await workspace.fetchMailbox(deviceId: 'dev1');
      final inbox = await workspace.listInbox();
      expect(inbox.where((e) => e.remoteId == 'm1').length, 1);
      expect(mailbox.acked, ['m1', 'm1']);

      await workspace.revokeMailbox();
      expect(workspace.identity.mailboxAddress, isNull);
      expect(workspace.identity.claimedEmail, isNull);
      expect(await workspace.vault.readMailboxToken(), isNull);
    },
  );
}

class _FakeMailbox extends MailboxClient {
  _FakeMailbox()
    : super(httpClient: MockClient((_) async => http.Response('{}', 404)));

  List<MailboxPendingItem> pendingItems = [];
  final List<String> acked = [];
  bool revoked = false;

  @override
  Future<List<MailboxPendingItem>> pending({
    required String mailboxToken,
  }) async => pendingItems;

  @override
  Future<Uint8List?> downloadBytes(
    MailboxPendingItem item, {
    required String mailboxToken,
  }) async {
    return Uint8List.fromList('%PDF-1.4 fake'.codeUnits);
  }

  @override
  Future<void> ack({
    required String mailboxToken,
    required String itemId,
  }) async {
    acked.add(itemId);
  }

  @override
  Future<void> revoke({required String mailboxToken}) async {
    revoked = true;
  }
}
