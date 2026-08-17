enum HermesPresence { missing, ready, incompatible }

class HermesStatus {
  const HermesStatus({
    required this.presence,
    this.protocolVersion = 1,
    this.packageVersion,
    this.capabilities = const [],
  });

  final HermesPresence presence;
  final int protocolVersion;
  final String? packageVersion;
  final List<String> capabilities;

  bool get isReady => presence == HermesPresence.ready;
}

class HermesRunRequest {
  const HermesRunRequest({
    required this.hermesHomePath,
    this.enabledSkillIds = const [],
    this.prompt,
    this.cronJobId,
    this.inboxItemIds = const [],
    this.grantedTools = const [],
  });

  final String hermesHomePath;
  final List<String> enabledSkillIds;
  final String? prompt;
  final String? cronJobId;
  final List<String> inboxItemIds;
  final List<String> grantedTools;
}

class HermesRunResult {
  const HermesRunResult({required this.ok, this.message = ''});

  final bool ok;
  final String message;
}

class HermesCronChange {
  const HermesCronChange({required this.jobId, required this.deleted});

  final String jobId;
  final bool deleted;
}

/// Phone Hermes runtime. Phase 1 ships [StubHermesAdapter] only.
abstract class HermesAdapter {
  Future<HermesStatus> status();
  Future<HermesRunResult> run(HermesRunRequest req);
  Stream<HermesCronChange> get onCronChanged;
}

class StubHermesAdapter implements HermesAdapter {
  @override
  Future<HermesStatus> status() async =>
      const HermesStatus(presence: HermesPresence.missing, protocolVersion: 1);

  @override
  Future<HermesRunResult> run(
    HermesRunRequest req,
  ) async => const HermesRunResult(
    ok: false,
    message:
        'The on-device agent is not installed yet. You can still drop PDFs and edit the plan.',
  );

  @override
  Stream<HermesCronChange> get onCronChanged => const Stream.empty();
}
