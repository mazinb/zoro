import 'dart:convert';
import 'dart:io';

import 'hermes_home_paths.dart';

class AgentIdentity {
  AgentIdentity({
    this.mailboxAddress,
    this.claimedEmail,
    List<String>? allowlist,
    this.protocolMin = HermesHomePaths.protocolVersion,
  }) : allowlist = allowlist ?? [];

  String? mailboxAddress;
  String? claimedEmail;
  List<String> allowlist;
  int protocolMin;

  Map<String, dynamic> toJson() => {
        'protocolMin': protocolMin,
        if (mailboxAddress != null) 'mailboxAddress': mailboxAddress,
        if (claimedEmail != null) 'claimedEmail': claimedEmail,
        'allowlist': allowlist,
      };

  static AgentIdentity fromJson(Map<String, dynamic>? m) {
    if (m == null) return AgentIdentity();
    final allow = m['allowlist'];
    return AgentIdentity(
      mailboxAddress: m['mailboxAddress']?.toString(),
      claimedEmail: m['claimedEmail']?.toString(),
      protocolMin: (m['protocolMin'] as num?)?.toInt() ?? HermesHomePaths.protocolVersion,
      allowlist: allow is List ? [for (final e in allow) e.toString()] : [],
    );
  }
}

class IdentityStore {
  IdentityStore(this.home);

  final Directory home;

  File get _file => File('${home.path}/${HermesHomePaths.identityFile}');

  Future<AgentIdentity> load() async {
    if (!await _file.exists()) {
      final id = AgentIdentity();
      await save(id);
      return id;
    }
    try {
      final raw = jsonDecode(await _file.readAsString());
      if (raw is Map) return AgentIdentity.fromJson(Map<String, dynamic>.from(raw));
    } catch (_) {}
    return AgentIdentity();
  }

  Future<void> save(AgentIdentity id) async {
    await _file.parent.create(recursive: true);
    await _file.writeAsString(
      const JsonEncoder.withIndent('  ').convert(id.toJson()),
      flush: true,
    );
  }
}
