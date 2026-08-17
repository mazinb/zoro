import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../api/api_exception.dart';
import '../app_env.dart';

class MailboxPendingItem {
  const MailboxPendingItem({
    required this.id,
    required this.fileName,
    this.from = '',
    this.subject = '',
    this.downloadUrl,
    this.bytesBase64,
  });

  final String id;
  final String fileName;
  final String from;
  final String subject;
  final String? downloadUrl;
  final String? bytesBase64;
}

class MailboxClaimInfo {
  const MailboxClaimInfo({
    required this.address,
    required this.mailboxToken,
    required this.claimedEmail,
  });

  final String address;
  final String mailboxToken;
  final String claimedEmail;
}

class MailboxStatus {
  const MailboxStatus({
    required this.state,
    this.address,
    this.claimedEmail,
    this.pendingCount = 0,
  });

  /// none | pending | verified | active
  final String state;
  final String? address;
  final String? claimedEmail;
  final int pendingCount;
}

/// Flutter client for getzoro mailbox claim / pending / ack.
class MailboxClient {
  MailboxClient({http.Client? httpClient}) : _client = httpClient ?? http.Client();

  final http.Client _client;

  Future<void> requestClaim({required String deviceId, required String email}) async {
    final uri = AppEnv.apiUri('/api/mobile/mailbox/claim');
    final res = await _client.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'deviceId': deviceId, 'email': email}),
    );
    final body = _decode(res.body);
    if (res.statusCode != 200) {
      throw ApiException(body['error']?.toString() ?? 'Could not send confirmation email', statusCode: res.statusCode);
    }
  }

  Future<MailboxStatus> claimStatus({required String deviceId}) async {
    final uri = AppEnv.apiUri('/api/mobile/mailbox/claim').replace(queryParameters: {'deviceId': deviceId});
    try {
      final res = await _client.get(uri);
      final body = _decode(res.body);
      if (res.statusCode != 200) return const MailboxStatus(state: 'none');
      return _statusFrom(body['data']);
    } catch (_) {
      return const MailboxStatus(state: 'none');
    }
  }

  Future<MailboxClaimInfo> finishClaim({required String deviceId, String? nonce}) async {
    final uri = AppEnv.apiUri('/api/mobile/mailbox/claim/finish');
    final res = await _client.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'deviceId': deviceId,
        if (nonce != null && nonce.isNotEmpty) 'nonce': nonce,
      }),
    );
    final body = _decode(res.body);
    if (res.statusCode != 200) {
      throw ApiException(body['error']?.toString() ?? 'Could not finish claim', statusCode: res.statusCode);
    }
    final data = body['data'];
    if (data is! Map) throw ApiException('Invalid claim response', statusCode: res.statusCode);
    final address = data['address']?.toString() ?? '';
    final token = data['mailboxToken']?.toString() ?? '';
    final email = data['claimedEmail']?.toString() ?? '';
    if (address.isEmpty || token.isEmpty) throw ApiException('Invalid claim response', statusCode: res.statusCode);
    return MailboxClaimInfo(address: address, mailboxToken: token, claimedEmail: email);
  }

  Future<MailboxStatus> status({String? mailboxToken, String? deviceId}) async {
    final uri = AppEnv.apiUri('/api/mobile/mailbox/status').replace(
      queryParameters: {
        if (deviceId != null && deviceId.isNotEmpty) 'deviceId': deviceId,
      },
    );
    try {
      final res = await _client.get(
        uri,
        headers: {
          if (mailboxToken != null && mailboxToken.isNotEmpty) 'Authorization': 'Bearer $mailboxToken',
        },
      );
      final body = _decode(res.body);
      if (res.statusCode != 200) return const MailboxStatus(state: 'none');
      return _statusFrom(body['data']);
    } catch (_) {
      return const MailboxStatus(state: 'none');
    }
  }

  Future<void> revoke({required String mailboxToken}) async {
    final uri = AppEnv.apiUri('/api/mobile/mailbox/revoke');
    final res = await _client.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $mailboxToken',
      },
      body: '{}',
    );
    if (res.statusCode != 200) {
      final body = _decode(res.body);
      throw ApiException(body['error']?.toString() ?? 'Could not disconnect mailbox', statusCode: res.statusCode);
    }
  }

  Future<({String address, String mailboxToken})?> register({
    required String deviceId,
    String? mailboxToken,
  }) async {
    final uri = AppEnv.apiUri('/api/mobile/mailbox/register');
    try {
      final res = await _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (mailboxToken != null && mailboxToken.isNotEmpty) 'Authorization': 'Bearer $mailboxToken',
        },
        body: jsonEncode({'deviceId': deviceId}),
      );
      final body = _decode(res.body);
      if (res.statusCode != 200) return null;
      final data = body['data'];
      if (data is! Map) return null;
      final address = data['address']?.toString() ?? '';
      final token = data['mailboxToken']?.toString() ?? '';
      if (address.isEmpty || token.isEmpty) return null;
      return (address: address, mailboxToken: token);
    } on ApiException {
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<List<MailboxPendingItem>> pending({required String mailboxToken}) async {
    final uri = AppEnv.apiUri('/api/mobile/mailbox/pending');
    try {
      final res = await _client.get(
        uri,
        headers: {'Authorization': 'Bearer $mailboxToken'},
      );
      final body = _decode(res.body);
      if (res.statusCode == 401) {
        throw ApiException(body['error']?.toString() ?? 'Mailbox authorization failed', statusCode: 401);
      }
      if (res.statusCode != 200) return [];
      final data = body['data'];
      if (data is! List) return [];
      return [
        for (final e in data)
          if (e is Map)
            MailboxPendingItem(
              id: e['id']?.toString() ?? '',
              fileName: e['fileName']?.toString() ?? 'attachment.pdf',
              from: e['from']?.toString() ?? '',
              subject: e['subject']?.toString() ?? '',
              downloadUrl: e['downloadUrl']?.toString(),
              bytesBase64: e['bytesBase64']?.toString(),
            ),
      ].where((e) => e.id.isNotEmpty).toList();
    } on ApiException {
      rethrow;
    } catch (_) {
      return [];
    }
  }

  Future<Uint8List?> downloadBytes(MailboxPendingItem item, {required String mailboxToken}) async {
    if (item.bytesBase64 != null && item.bytesBase64!.isNotEmpty) {
      try {
        return Uint8List.fromList(base64Decode(item.bytesBase64!));
      } catch (_) {
        return null;
      }
    }
    final url = item.downloadUrl;
    if (url == null || url.isEmpty) return null;
    try {
      final res = await _client.get(
        Uri.parse(url),
        headers: {'Authorization': 'Bearer $mailboxToken'},
      );
      if (res.statusCode != 200) return null;
      return res.bodyBytes;
    } catch (_) {
      return null;
    }
  }

  Future<void> ack({required String mailboxToken, required String itemId}) async {
    final uri = AppEnv.apiUri('/api/mobile/mailbox/ack');
    try {
      await _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $mailboxToken',
        },
        body: jsonEncode({'id': itemId}),
      );
    } catch (_) {}
  }

  MailboxStatus _statusFrom(Object? data) {
    if (data is! Map) return const MailboxStatus(state: 'none');
    return MailboxStatus(
      state: data['state']?.toString() ?? 'none',
      address: data['address']?.toString(),
      claimedEmail: data['claimedEmail']?.toString() ?? data['email']?.toString(),
      pendingCount: (data['pendingCount'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> _decode(String raw) {
    if (raw.trim().isEmpty) return {};
    try {
      final v = jsonDecode(raw);
      if (v is Map<String, dynamic>) return v;
      if (v is Map) return Map<String, dynamic>.from(v);
    } catch (_) {}
    return {};
  }
}

String? mailboxNonceFromUri(Uri uri) {
  final nonce = uri.queryParameters['nonce']?.trim();
  if (nonce != null && nonce.isNotEmpty) return nonce;
  return null;
}

bool isMailboxClaimUri(Uri uri) {
  if (uri.scheme == 'zoro' && uri.host == 'mailbox') return true;
  if ((uri.scheme == 'https' || uri.scheme == 'http') && uri.path.startsWith('/mailbox/claim')) {
    return true;
  }
  return false;
}
