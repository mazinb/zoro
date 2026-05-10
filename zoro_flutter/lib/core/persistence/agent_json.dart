import '../state/app_model.dart';

Map<String, dynamic> appAgentToJson(AppAgent a) => {
      'id': a.id,
      'name': a.name,
      'description': a.description,
      'systemPrompt': a.systemPrompt,
      'contextMarkdown': a.contextMarkdown,
      'kind': a.kind.name,
      'toolHomeSummary': a.toolHomeSummary,
      'toolWebResearch': a.toolWebResearch,
      'toolSettingsAdmin': a.toolSettingsAdmin,
      'llmProviderOverride': a.llmProviderOverride?.name,
      'permissions': [
        for (final p in a.permissions)
          {
            'domain': p.domain.name,
            'access': p.access.name,
          },
      ],
    };

AppAgent? appAgentFromJson(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final id = m['id']?.toString();
  final name = m['name']?.toString();
  if (id == null || name == null) return null;
  final perms = <AgentPermission>[];
  final pr = m['permissions'];
  if (pr is List) {
    for (final e in pr) {
      if (e is! Map) continue;
      final em = Map<String, dynamic>.from(e);
      final d = _parseDomain(em['domain']?.toString());
      final a = _parseAccess(em['access']?.toString());
      if (d != null && a != null) {
        perms.add(AgentPermission(domain: d, access: a));
      }
    }
  }
  return AppAgent(
    id: id,
    name: name,
    description: m['description']?.toString() ?? '',
    systemPrompt: m['systemPrompt']?.toString() ?? '',
    permissions: perms,
    contextMarkdown: m['contextMarkdown']?.toString() ?? '',
    kind: _parseKind(m['kind']?.toString()) ?? AppAgentKind.analyst,
    toolHomeSummary: m['toolHomeSummary'] == true,
    toolWebResearch: m['toolWebResearch'] == true,
    toolSettingsAdmin: m['toolSettingsAdmin'] == true,
    llmProviderOverride: _parseLlmProvider(m['llmProviderOverride']?.toString()),
  );
}

AgentDomain? _parseDomain(String? s) {
  if (s == null) return null;
  for (final d in AgentDomain.values) {
    if (d.name == s) return d;
  }
  return null;
}

AgentAccess? _parseAccess(String? s) {
  if (s == null) return null;
  for (final a in AgentAccess.values) {
    if (a.name == s) return a;
  }
  return null;
}

AppAgentKind? _parseKind(String? s) {
  if (s == null) return null;
  for (final k in AppAgentKind.values) {
    if (k.name == s) return k;
  }
  return null;
}

LlmProvider? _parseLlmProvider(String? s) {
  if (s == null || s.isEmpty) return null;
  for (final p in LlmProvider.values) {
    if (p.name == s) return p;
  }
  return null;
}
