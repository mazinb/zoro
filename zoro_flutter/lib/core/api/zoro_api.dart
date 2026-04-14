import 'dart:convert';

import 'package:http/http.dart' as http;

import '../app_env.dart';
import 'api_exception.dart';

class ZoroApi {
  ZoroApi({http.Client? httpClient}) : _client = httpClient ?? http.Client();

  final http.Client _client;

  /// Load profile by [token] (users.verification_token) or [email] (registered users).
  Future<Map<String, dynamic>> getUserData({
    String? token,
    String? email,
  }) async {
    if ((token == null || token.isEmpty) && (email == null || email.isEmpty)) {
      throw ApiException('Token or email is required');
    }
    final query = <String, String>{
      if (token != null && token.isNotEmpty) 'token': token,
      if (email != null && email.isNotEmpty) 'email': email,
    };
    final uri = AppEnv.apiUri('/api/user-data').replace(
      queryParameters: query,
    );
    final res = await _client.get(uri);
    final body = _decodeJson(res.body);
    if (res.statusCode != 200) {
      throw ApiException(
        body['error']?.toString() ?? 'Failed to load profile',
        statusCode: res.statusCode,
      );
    }
    return body;
  }

  Future<void> sendMagicLink({
    required String email,
    String redirectPath = '/expenses',
    bool inviteIfUnregistered = true,
  }) async {
    final uri = AppEnv.apiUri('/api/auth/send-magic-link');
    final res = await _client.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'redirectPath': redirectPath,
        'inviteIfUnregistered': inviteIfUnregistered,
      }),
    );
    final body = _decodeJson(res.body);
    if (res.statusCode != 200) {
      throw ApiException(
        body['error']?.toString() ?? 'Could not send email',
        statusCode: res.statusCode,
      );
    }
    if (body['registered'] == false && body['invited'] != true) {
      throw ApiException('No account for this email yet. Check your inbox for a signup link.');
    }
  }

  /// Multipart upload matching web `parse-one-file` route.
  Future<Map<String, dynamic>> parseExpenseFile({
    required String token,
    required String filePath,
    required String fileName,
    required String month,
  }) async {
    final uri = AppEnv.apiUri('/api/expenses/parse-one-file');
    final request = http.MultipartRequest('POST', uri);
    request.fields['token'] = token;
    request.fields['fileName'] = fileName;
    request.fields['month'] = month;
    request.files.add(
      await http.MultipartFile.fromPath('file', filePath),
    );
    final streamed = await _client.send(request);
    final res = await http.Response.fromStream(streamed);
    final body = _decodeJson(res.body);
    if (res.statusCode != 200) {
      final msg = body['error']?.toString() ??
          body['message']?.toString() ??
          'Import failed';
      throw ApiException(msg, statusCode: res.statusCode);
    }
    return body;
  }

  Map<String, dynamic> _decodeJson(String raw) {
    if (raw.isEmpty) return {};
    final decoded = jsonDecode(raw);
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
    return {};
  }
}
