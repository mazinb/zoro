import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/api_exception.dart';
import '../api/zoro_api.dart';

const _kTokenKey = 'zoro_verification_token';
const _kEmailKey = 'zoro_signed_in_email';

class SessionController extends ChangeNotifier {
  SessionController({
    required ZoroApi api,
    FlutterSecureStorage? storage,
  })  : _api = api,
        _storage = storage ?? const FlutterSecureStorage();

  final ZoroApi _api;
  final FlutterSecureStorage _storage;

  ZoroApi get api => _api;

  String? _token;
  String? _savedEmail;
  Map<String, dynamic>? _userData;
  bool _loading = true;
  String? _lastError;

  String? get token => _token;
  String? get savedEmail => _savedEmail;
  Map<String, dynamic>? get userData => _userData;
  bool get loading => _loading;
  String? get lastError => _lastError;
  bool get isSignedIn =>
      _token != null && _userData != null && _userData!.isNotEmpty;

  Future<void> bootstrap() async {
    _loading = true;
    _lastError = null;
    notifyListeners();
    try {
      _savedEmail = await _storage.read(key: _kEmailKey);
      _token = await _storage.read(key: _kTokenKey);
      if (_token != null && _token!.isNotEmpty) {
        await _loadUser(quiet: true);
      } else {
        _userData = null;
      }
    } catch (e) {
      _lastError = e.toString();
      _userData = null;
      _token = null;
      await _storage.delete(key: _kTokenKey);
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> signInWithEmail(String rawEmail) async {
    final email = rawEmail.trim().toLowerCase();
    if (email.isEmpty || !email.contains('@')) {
      _lastError = 'Enter a valid email address';
      notifyListeners();
      return;
    }
    _loading = true;
    _lastError = null;
    notifyListeners();
    try {
      final body = await _api.getUserData(email: email);
      final data = body['data'];
      if (data == null || data is! Map) {
        throw ApiException(
          'No Zoro account for this email yet. Tap “Email me a sign-in link” below.',
        );
      }
      final map = Map<String, dynamic>.from(data);
      final tok = map['verification_token']?.toString();
      if (tok == null || tok.isEmpty) {
        throw ApiException(
          'This account has no sign-in key yet. Use the link from your email.',
        );
      }
      await _persistSession(token: tok, map: map, email: email);
    } on ApiException catch (e) {
      _token = null;
      _userData = null;
      _lastError = e.message;
      await _storage.delete(key: _kTokenKey);
    } catch (e) {
      _token = null;
      _userData = null;
      _lastError = e.toString();
      await _storage.delete(key: _kTokenKey);
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> signInWithToken(String raw) async {
    final t = raw.trim();
    if (t.isEmpty) {
      _lastError = 'Sign-in link or token is empty';
      notifyListeners();
      return;
    }
    _loading = true;
    _lastError = null;
    notifyListeners();
    try {
      final body = await _api.getUserData(token: t);
      final data = body['data'];
      if (data == null || data is! Map) {
        throw ApiException('Invalid or expired sign-in link');
      }
      final map = Map<String, dynamic>.from(data);
      if (map.isEmpty) {
        throw ApiException('Invalid or expired sign-in link');
      }
      final email = map['email']?.toString().trim().toLowerCase();
      await _persistSession(token: t, map: map, email: email);
    } on ApiException catch (e) {
      _token = null;
      _userData = null;
      _lastError = e.message;
      await _storage.delete(key: _kTokenKey);
    } catch (e) {
      _token = null;
      _userData = null;
      _lastError = e.toString();
      await _storage.delete(key: _kTokenKey);
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> _persistSession({
    required String token,
    required Map<String, dynamic> map,
    String? email,
  }) async {
    _token = token;
    _userData = map;
    await _storage.write(key: _kTokenKey, value: token);
    final em = email ?? map['email']?.toString().trim().toLowerCase();
    if (em != null && em.isNotEmpty) {
      _savedEmail = em;
      await _storage.write(key: _kEmailKey, value: em);
    }
  }

  Future<void> refreshUser() async {
    if (_token == null) return;
    _lastError = null;
    try {
      await _loadUser(quiet: true);
    } on ApiException catch (e) {
      _lastError = e.message;
    } catch (e) {
      _lastError = e.toString();
    }
    notifyListeners();
  }

  Future<void> _loadUser({required bool quiet}) async {
    final body = await _api.getUserData(token: _token!);
    final data = body['data'];
    if (data == null || data is! Map) {
      throw ApiException('Invalid or unknown token');
    }
    _userData = Map<String, dynamic>.from(data);
  }

  /// Clears the session on this device. Keeps last email for quicker sign-in.
  Future<void> signOut() async {
    _token = null;
    _userData = null;
    _lastError = null;
    await _storage.delete(key: _kTokenKey);
    notifyListeners();
  }
}
